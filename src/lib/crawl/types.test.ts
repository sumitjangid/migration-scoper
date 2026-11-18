import { describe, expect, it } from "vitest";
import { CrawlResultSchema } from "./types";

describe("CrawlResultSchema", () => {
  it("accepts a minimal valid crawl result", () => {
    const result = CrawlResultSchema.parse({
      requestedUrl: "https://example.com",
      finalUrl: "https://example.com/",
      platform: { name: "Unknown", confidence: 0, evidence: [] },
      pages: [],
      robotsAllowed: true,
      robotsNote: "No applicable disallow rule found.",
      warnings: [],
      crawledAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.pages).toEqual([]);
  });

  it("rejects an invalid confidence", () => {
    expect(() => CrawlResultSchema.parse({
      requestedUrl: "https://example.com",
      finalUrl: "https://example.com/",
      platform: { name: "Shopify", confidence: 2, evidence: [] },
      pages: [],
      robotsAllowed: true,
      robotsNote: "allowed",
      warnings: [],
      crawledAt: "2026-01-01T00:00:00.000Z",
    })).toThrow();
  });
});
