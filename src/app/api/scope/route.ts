import { NextResponse } from "next/server";
import { z } from "zod";
import { captureStorefront } from "../../../lib/crawl/capture";
import { detectPlatform } from "../../../lib/crawl/detect-platform";
import { loadRobotsPolicy, RobotsPolicyError } from "../../../lib/crawl/robots";
import { CrawlResultSchema } from "../../../lib/crawl/types";
import { assertPublicHttpUrl } from "../../../lib/crawl/url-safety";
import { createReport } from "../../../lib/analyse/report";
import { saveReport } from "../../../lib/report/store";
import { enforceScopeRateLimit, ScopeRateLimitError } from "../../../lib/security/rate-limit";
import { isIP } from "node:net";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const maxRequestBytes = 8_192;

const RequestSchema = z.object({
  url: z.string().url(),
  monthlyTraffic: z.number().nonnegative().optional(),
  catalogSize: z.number().nonnegative().optional(),
});

class ScopeRequestTooLargeError extends Error {
  constructor() {
    super("The scope request is too large.");
    this.name = "ScopeRequestTooLargeError";
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxRequestBytes) {
    throw new ScopeRequestTooLargeError();
  }
  if (!request.body) throw new Error("The scope request body is required.");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxRequestBytes) {
      await reader.cancel();
      throw new ScopeRequestTooLargeError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}

function getClientAddress(request: Request): string {
  const forwardedAddresses = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()) ?? [];
  const forwardedAddress = forwardedAddresses.reverse().find((address) => isIP(address));
  const realAddress = request.headers.get("x-real-ip")?.trim();
  const address = forwardedAddress ?? (realAddress && isIP(realAddress) ? realAddress : "");
  return address || (process.env.NODE_ENV === "production" ? "" : "local");
}

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await readJsonBody(request));
    await enforceScopeRateLimit(getClientAddress(request));
    await assertPublicHttpUrl(body.url);
    const robotsPolicy = await loadRobotsPolicy(body.url);
    const pages = await captureStorefront(body.url, { robotsPolicy });
    const crawl = CrawlResultSchema.parse({
      requestedUrl: body.url,
      finalUrl: pages[0]?.url ?? body.url,
      platform: detectPlatform(pages),
      pages,
      robotsAllowed: true,
      robotsNote: robotsPolicy.note,
      warnings: [
        ...(pages.length === 0 ? ["No pages were captured."] : []),
        "Cart and checkout pages, third-party resources, and non-GET requests are excluded from capture.",
      ],
      crawledAt: new Date().toISOString(),
    });
    const report = createReport(crawl, {
      monthlyTraffic: body.monthlyTraffic,
      catalogSize: body.catalogSize,
    });

    return NextResponse.json({ id: saveReport(report), report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scope analysis failed.";
    let status = 400;
    if (error instanceof ScopeRateLimitError) status = error.status;
    else if (error instanceof RobotsPolicyError) status = 403;
    else if (error instanceof ScopeRequestTooLargeError) status = 413;
    return NextResponse.json({ error: message }, { status });
  }
}
