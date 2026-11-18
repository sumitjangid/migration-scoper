import { describe, expect, it } from "vitest";
import type { CapturedPage, CrawlResult } from "../crawl/types";
import { ReportSchema } from "./schemas";
import { analyseRendering } from "./rendering";
import { analyseRisks } from "./risks";
import { estimateProject } from "./estimate";
import { createReport } from "./report";

function page(overrides: Partial<CapturedPage> = {}): CapturedPage {
  return {
    url: "https://example.com/product/example",
    template: "product",
    rawHtml: "<html><head><link rel=\"canonical\" href=\"https://example.com/product/example\"></head><body>Example product</body></html>",
    renderedHtml: "<html><head><link rel=\"canonical\" href=\"https://example.com/product/example\"></head><body>Example product</body></html>",
    status: 200,
    headers: {},
    networkRequests: [],
    jsonLd: [{ "@type": "Product" }],
    scriptCount: 3,
    scriptBytes: 100,
    capturedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("Milestone 2 analysis", () => {
  it("validates a complete report", () => {
    const crawl: CrawlResult = {
      requestedUrl: "https://example.com",
      finalUrl: "https://example.com/",
      platform: { name: "Unknown", confidence: 0, evidence: [] },
      pages: [page()],
      robotsAllowed: true,
      robotsNote: "No applicable disallow rule found.",
      warnings: [],
      crawledAt: "2026-01-01T00:00:00.000Z",
    };

    const report = createReport(crawl);
    expect(ReportSchema.parse(report).templates).toHaveLength(1);
  });

  it("recommends ISR for product and PPR for client-rendered content", () => {
    expect(analyseRendering([page()])[0]?.strategy).toBe("ISR");
    expect(analyseRendering([page({
      renderedHtml: "<html><body>" + "<span>Rendered content</span>".repeat(100) + "</body></html>",
    })])[0]?.strategy).toBe("PPR");
  });

  it("flags canonical, structured-data, script, and crawler risks", () => {
    const risks = analyseRisks([page({
      template: "cart",
      url: "https://example.com/cart",
      rawHtml: "<html><body>Cart</body></html>",
      renderedHtml: "<html><body>" + "<span>Rendered cart content</span>".repeat(100) + "</body></html>",
      jsonLd: [],
      scriptCount: 25,
      scriptBytes: 2_000_000,
    })]);
    expect(risks.map((risk) => risk.category)).toEqual(expect.arrayContaining([
      "crawler-visibility",
      "seo",
      "structured-data",
      "scripts",
      "checkout",
    ]));
  });

  it("uses optional traffic and catalog inputs in the estimate", () => {
    expect(estimateProject([page()], {}).tshirtSize).toBe("S");
    expect(estimateProject([page()], {
      monthlyTraffic: 6_000_000,
      catalogSize: 150_000,
    }).tshirtSize).toBe("L");
  });
});
