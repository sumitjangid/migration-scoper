import { NextResponse } from "next/server";
import { z } from "zod";
import { captureStorefront } from "../../../lib/crawl/capture";
import { detectPlatform } from "../../../lib/crawl/detect-platform";
import { loadRobotsPolicy, RobotsPolicyError } from "../../../lib/crawl/robots";
import { CrawlResultSchema } from "../../../lib/crawl/types";
import { createReport } from "../../../lib/analyse/report";
import { saveReport } from "../../../lib/report/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const RequestSchema = z.object({
  url: z.string().url(),
  monthlyTraffic: z.number().nonnegative().optional(),
  catalogSize: z.number().nonnegative().optional(),
});

export async function POST(request: Request) {
  try {
    const body = RequestSchema.parse(await request.json());
    const parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json({ error: "Only HTTP(S) storefront URLs are supported." }, { status: 400 });
    }

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
    const status = error instanceof RobotsPolicyError ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
