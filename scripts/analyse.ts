import { readFileSync } from "node:fs";
import { CrawlResultSchema } from "../src/lib/crawl/types";
import { createReport } from "../src/lib/analyse/report";

function readStdin(): string {
  return readFileSync(0, "utf8");
}

function option(name: string): number | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`--${name} must be a non-negative number.`);
  }
  return value;
}

async function main() {
  const source = readStdin();
  if (!source.trim()) {
    throw new Error("Provide a CrawlResult JSON document on stdin.");
  }
  const crawl = CrawlResultSchema.parse(JSON.parse(source));
  const report = createReport(crawl, {
    monthlyTraffic: option("traffic"),
    catalogSize: option("catalog"),
  });
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
