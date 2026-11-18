import { chromium, type BrowserContext, type Request } from "playwright";
import type { CapturedPage } from "./types";
import { classifyUrl } from "./discover";

const timeout = 30_000;

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

export async function captureUrl(
  context: BrowserContext,
  url: string,
  templateHint?: CapturedPage["template"],
): Promise<CapturedPage> {
  const page = await context.newPage();
  const networkRequests: CapturedPage["networkRequests"] = [];

  const recordRequest = (request: Request) => {
    networkRequests.push({
      url: request.url(),
      resourceType: request.resourceType(),
    });
  };
  page.on("request", recordRequest);

  let status = 0;
  let finalUrl = url;
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    status = response?.status() ?? 0;
    finalUrl = page.url();
    await page.waitForTimeout(1500);
  } finally {
    page.off("request", recordRequest);
  }

  const rawResponse = await context.request.get(finalUrl, { timeout });
  const rawHtml = await rawResponse.text();
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
  for (const scriptUrl of scripts.slice(0, 30)) {
    try {
      const scriptResponse = await context.request.get(scriptUrl, { timeout: 10_000 });
      if (scriptResponse.ok()) scriptBytes += (await scriptResponse.body()).byteLength;
    } catch {
      // Script availability is optional evidence and does not block the capture.
    }
  }

  const headers = Object.fromEntries(
    Object.entries((await context.request.get(finalUrl, { timeout })).headers())
      .map(([key, value]) => [key.toLowerCase(), value]),
  );

  await page.close();

  return {
    url: finalUrl,
    template: templateHint ?? classifyUrl(finalUrl, finalUrl === url),
    rawHtml,
    renderedHtml,
    status,
    headers,
    networkRequests,
    jsonLd,
    scriptCount: scripts.length,
    scriptBytes,
    capturedAt: new Date().toISOString(),
  };
}

export async function captureStorefront(
  startUrl: string,
  options: { concurrency?: number; timeoutMs?: number } = {},
) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "MigrationCopilotBot/0.1 (+public storefront scope analysis)",
  });
  try {
    const page = await context.newPage();
    await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: options.timeoutMs ?? timeout });
    const discoveryPage = await context.newPage();
    await discoveryPage.goto(startUrl, { waitUntil: "domcontentloaded", timeout: options.timeoutMs ?? timeout });

    const { discoverTemplates } = await import("./discover");
    const candidates = await discoverTemplates(discoveryPage, startUrl);
    await discoveryPage.close();
    await page.close();

    const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 4));
    const captured: CapturedPage[] = [];
    for (let index = 0; index < candidates.length; index += concurrency) {
      const batch = candidates.slice(index, index + concurrency);
      captured.push(...await Promise.all(batch.map((candidate) =>
        captureUrl(context, candidate.url, candidate.template),
      )));
    }
    return captured;
  } finally {
    await context.close();
    await browser.close();
  }
}
