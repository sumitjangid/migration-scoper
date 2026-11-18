import { describe, expect, it } from "vitest";
import type { Report } from "../analyse/schemas";
import { renderMarkdown } from "./markdown";

describe("report Markdown export", () => {
  it("includes key report sections and values", () => {
    const report: Report = {
      requestedUrl: "https://example.com",
      platform: { name: "Shopify", confidence: 0.9, evidence: ["Shopify marker"] },
      templates: [{
        template: "product",
        strategy: "ISR",
        rationale: "Product content changes periodically.",
        evidence: ["Canonical is present"],
        assumption: false,
      }],
      risks: [],
      estimate: {
        tshirtSize: "M",
        effortRangeWeeks: { min: 4, max: 8 },
        vercelUsageRangeUsdMonthly: { min: 100, max: 400 },
        assumptions: ["Example assumptions"],
      },
      discoveryQuestions: [{
        topic: "Checkout",
        question: "Is checkout hosted externally?",
        reason: "The boundary could not be observed.",
      }],
      phasedOutline: [{ phase: "Discovery", summary: "Validate integrations." }],
      assumptionsAndUnknowns: ["Backend behavior is unknown."],
      analyzedAt: "2026-01-01T00:00:00.000Z",
    };

    const markdown = renderMarkdown(report);
    expect(markdown).toContain("# Migration scope report");
    expect(markdown).toContain("| product | ISR |");
    expect(markdown).toContain("## Discovery questions");
    expect(markdown).toContain("Backend behavior is unknown.");
  });
});
