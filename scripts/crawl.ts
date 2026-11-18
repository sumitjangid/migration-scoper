import { CrawlResultSchema } from "../src/lib/crawl/types";
import { captureStorefront } from "../src/lib/crawl/capture";
import { detectPlatform } from "../src/lib/crawl/detect-platform";
import { checkRobots } from "../src/lib/crawl/robots";

async function main() {
  const requestedUrl = process.argv[2];
  if (!requestedUrl) {
    console.error("Usage: npm run crawl -- <storefront-url>");
    process.exit(1);
  }

  let parsed: URL;
  try {
    parsed = new URL(requestedUrl);
  } catch {
    console.error("The crawl target must be an absolute HTTP(S) URL.");
    process.exit(1);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    console.error("The crawl target must use HTTP or HTTPS.");
    process.exit(1);
  }

  const robots = await checkRobots(requestedUrl);
  if (!robots.allowed) {
    throw new Error(`Crawl blocked by robots.txt: ${robots.note}`);
  }

  const pages = await captureStorefront(requestedUrl);
  const result = CrawlResultSchema.parse({
    requestedUrl,
    finalUrl: pages[0]?.url ?? requestedUrl,
    platform: detectPlatform(pages),
    pages,
    robotsAllowed: robots.allowed,
    robotsNote: robots.note,
    warnings: pages.length === 0 ? ["No pages were captured."] : [],
    crawledAt: new Date().toISOString(),
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
