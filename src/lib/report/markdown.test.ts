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

  it("includes labelled AI content only when present", () => {
    const report: Report = {
      requestedUrl: "https://example.com",
      platform: { name: "Shopify", confidence: 0.9, evidence: ["Shopify marker"] },
      templates: [],
      risks: [],
      estimate: {
        tshirtSize: "M",
        effortRangeWeeks: { min: 4, max: 8 },
        vercelUsageRangeUsdMonthly: { min: 100, max: 400 },
        assumptions: [],
      },
      discoveryQuestions: [],
      phasedOutline: [],
      assumptionsAndUnknowns: [],
      analyzedAt: "2026-01-01T00:00:00.000Z",
      ai: {
        summary: {
          summary: "The crawl shows moderate complexity.",
          keyRisks: ["Structured data was not observed."],
          confidence: "medium",
          evidence: [{ signal: "No JSON-LD objects were captured.", template: "product" }],
        },
        rationales: [{
          template: "product",
          strategy: "ISR",
          explanation: "Revalidate the product page while serving cached content.",
          evidence: [{ signal: "Product content changes periodically.", template: "product" }],
        }],
        questions: [{
          question: "Which system owns product inventory?",
          why: "The public crawl does not expose inventory ownership.",
          category: "integrations",
          evidence: [{ signal: "Backend behavior is unknown.", template: "crawl" }],
        }],
        model: "openai/test-model",
        generatedAt: "2026-01-01T00:00:00.000Z",
      },
    };

    const markdown = renderMarkdown(report);
    expect(markdown).toContain("## AI-generated executive summary");
    expect(markdown).toContain("product: No JSON-LD objects were captured.");
    expect(markdown).toContain("Structured data was not observed.");
    expect(markdown).toContain("## AI-generated rendering rationales");
    expect(markdown).toContain("Revalidate the product page while serving cached content.");
    expect(markdown).toContain("product: Product content changes periodically.");
    expect(markdown).toContain("## AI-generated discovery questions");
    expect(markdown).toContain("Which system owns product inventory?");
    expect(markdown).toContain("crawl: Backend behavior is unknown.");
  });
});
