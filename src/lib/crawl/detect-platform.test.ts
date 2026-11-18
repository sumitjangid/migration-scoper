import { describe, expect, it } from "vitest";
import { detectPlatform } from "./detect-platform";
import type { CapturedPage } from "./types";

function page(overrides: Partial<CapturedPage>): CapturedPage {
  return {
    url: "https://example.com",
    template: "home",
    rawHtml: "",
    renderedHtml: "",
    status: 200,
    headers: {},
    networkRequests: [],
    jsonLd: [],
    scriptCount: 0,
    scriptBytes: 0,
    capturedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("detectPlatform", () => {
  it("detects Shopify CDN evidence", () => {
    const result = detectPlatform([
      page({ renderedHtml: '<script src="https://cdn.shopify.com/theme.js"></script>' }),
    ]);
    expect(result.name).toBe("Shopify");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("detects Magento static paths", () => {
    const result = detectPlatform([
      page({ url: "https://example.com/static/version123/frontend/theme.css" }),
    ]);
    expect(result.name).toBe("Magento");
  });

  it("returns Unknown without evidence", () => {
    expect(detectPlatform([page({})])).toEqual({
      name: "Unknown",
      confidence: 0,
      evidence: [],
    });
  });
});
