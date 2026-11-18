import { chromium, type BrowserContext, type Page, type Request, type Response } from "playwright";
import type { CapturedPage } from "./types";
import { classifyUrl, discoverTemplates, isSensitiveUrl } from "./discover";
import { RobotsPolicyError, type RobotsPolicy } from "./robots";

const defaultTimeoutMs = 30_000;
const pageDelayMs = 1_000;
const maxSupportedCrawlDelaySeconds = 30;
const maxPages = 8;

type PageObservations = {
  networkRequests: CapturedPage["networkRequests"];
  scriptResponses: Response[];
};

function observePage(page: Page): PageObservations {
  const observations: PageObservations = { networkRequests: [], scriptResponses: [] };
  page.on("request", (request: Request) => {
    observations.networkRequests.push({
      url: request.url(),
      resourceType: request.resourceType(),
    });
  });
  page.on("response", (response: Response) => {
    if (response.request().resourceType() === "script") {
      observations.scriptResponses.push(response);
    }
  });
  return observations;
}

async function installRequestRestrictions(
  context: BrowserContext,
  origin: string,
  robotsPolicy: RobotsPolicy,
): Promise<void> {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      await route.abort("blockedbyclient");
      return;
    }

    let url: URL;
    try {
      url = new URL(request.url());
    } catch {
      await route.abort("blockedbyclient");
      return;
    }

    if (
      url.origin !== origin
      || (request.isNavigationRequest() && isSensitiveUrl(url.toString()))
      || !robotsPolicy.check(url.toString()).allowed
    ) {
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
}

async function captureLoadedPage(
  page: Page,
  response: Response | null,
  url: string,
  observations: PageObservations,
  templateHint?: CapturedPage["template"],
): Promise<CapturedPage> {
  if (!response) {
    throw new Error(`The storefront returned no HTTP response for ${url}.`);
  }

  await page.waitForTimeout(1_500);
  const finalUrl = page.url();
  const finalDecision = new URL(finalUrl).origin === new URL(url).origin
    ? { allowed: true }
    : { allowed: false };
  if (!finalDecision.allowed) {
    throw new RobotsPolicyError("A storefront page redirected outside the checked origin; capture stopped.");
  }

  const rawHtml = await response.text();
  const renderedHtml = await page.content();
  const parsedJsonLd = await page.evaluate(() =>
    [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((element) => {
        try {
          return JSON.parse(element.textContent ?? "{}") as unknown;
        } catch {
          return null;
        }
      }),
  );
  const jsonLd = normalizeJsonLd(parsedJsonLd);
  const scripts = await page.locator("script[src]").evaluateAll((elements) =>
    elements.map((element) => (element as HTMLScriptElement).src),
  );

  let scriptBytes = 0;
  for (const scriptResponse of observations.scriptResponses.slice(0, 30)) {
    if (new URL(scriptResponse.url()).origin !== new URL(url).origin || !scriptResponse.ok()) continue;
    try {
      scriptBytes += (await scriptResponse.body()).byteLength;
    } catch {
      // Some scripts may no longer be available from the browser response cache.
    }
  }

  const headers = Object.fromEntries(
    Object.entries(response.headers()).map(([key, value]) => [key.toLowerCase(), value]),
  );

  return {
    url: finalUrl,
    template: templateHint ?? classifyUrl(finalUrl, finalUrl === url),
    rawHtml,
    renderedHtml,
    status: response.status(),
    headers,
    networkRequests: observations.networkRequests,
    jsonLd,
    scriptCount: scripts.length,
    scriptBytes,
    capturedAt: new Date().toISOString(),
  };
}

export function normalizeJsonLd(values: unknown[]): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      records.push(...normalizeJsonLd(value));
    } else if (value !== null && typeof value === "object") {
      records.push(value as Record<string, unknown>);
    }
  }
  return records;
}

async function captureUrl(
  context: BrowserContext,
  url: string,
  timeoutMs: number,
  templateHint?: CapturedPage["template"],
): Promise<CapturedPage> {
  const page = await context.newPage();
  const observations = observePage(page);
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    return await captureLoadedPage(page, response, url, observations, templateHint);
  } finally {
    await page.close();
  }
}

export async function captureStorefront(
  startUrl: string,
  options: { robotsPolicy: RobotsPolicy; timeoutMs?: number },
): Promise<CapturedPage[]> {
  const timeoutMs = options.timeoutMs ?? defaultTimeoutMs;
  const origin = new URL(startUrl).origin;
  const robotsPolicy = options.robotsPolicy;

  if (robotsPolicy.origin !== origin) {
    throw new RobotsPolicyError("The robots.txt policy does not match the storefront origin.");
  }
  if (!robotsPolicy.check(startUrl).allowed) {
    throw new RobotsPolicyError(`Crawl blocked: ${robotsPolicy.check(startUrl).note}`);
  }
  if (isSensitiveUrl(startUrl)) {
    throw new RobotsPolicyError("Cart and checkout URLs are excluded from crawling.");
  }
  if (robotsPolicy.crawlDelaySeconds > maxSupportedCrawlDelaySeconds) {
    throw new RobotsPolicyError(
      `The site requests a crawl delay over ${maxSupportedCrawlDelaySeconds} seconds; crawl stopped.`,
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "MigrationCopilotBot/0.1 (+public storefront scope analysis)",
  });

  try {
    await installRequestRestrictions(context, origin, robotsPolicy);
    const discoveryPage = await context.newPage();
    const rootObservations = observePage(discoveryPage);
    const rootResponse = await discoveryPage.goto(startUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    const candidates = await discoverTemplates(discoveryPage, startUrl, maxPages);
    const allowedCandidates = candidates.filter((candidate) =>
      !isSensitiveUrl(candidate.url) && robotsPolicy.check(candidate.url).allowed,
    );
    if (!allowedCandidates.some((candidate) => candidate.url === startUrl)) {
      throw new RobotsPolicyError("The starting page is not allowed by the robots.txt policy.");
    }

    const captured: CapturedPage[] = [];
    captured.push(await captureLoadedPage(
      discoveryPage,
      rootResponse,
      startUrl,
      rootObservations,
      "home",
    ));

    const remaining = allowedCandidates.filter((candidate) => candidate.url !== startUrl);
    const delayMs = Math.max(pageDelayMs, robotsPolicy.crawlDelaySeconds * 1_000);
    for (const candidate of remaining) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      captured.push(await captureUrl(context, candidate.url, timeoutMs, candidate.template));
    }
    await discoveryPage.close();
    return captured;
  } finally {
    await context.close();
    await browser.close();
  }
}
