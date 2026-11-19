import { describe, expect, it } from "vitest";
import fixture from "./fixtures/rule-findings.json";
import {
  DiscoveryOutputSchema,
  ExecutiveSummarySchema,
  RationaleOutputSchema,
  RuleFindingsSchema,
} from "./schemas";

describe("AI schemas", () => {
  it("accepts the fixed RuleFindings fixture", () => {
    expect(() => RuleFindingsSchema.parse(fixture)).not.toThrow();
  });

  it("rejects discovery items without evidence", () => {
    expect(() => DiscoveryOutputSchema.parse({
      questions: Array.from({ length: 5 }, (_, index) => ({
        question: `Question ${index}`,
        why: "Reason",
        category: "integrations",
        evidence: [],
      })),
    })).toThrow();
  });

  it("rejects over-length executive summaries", () => {
    expect(() => ExecutiveSummarySchema.parse({
      summary: "x".repeat(901),
      keyRisks: [],
      confidence: "high",
      evidence: [{ signal: "A real finding" }],
    })).toThrow();
  });

  it("rejects executive summaries without evidence", () => {
    expect(() => ExecutiveSummarySchema.parse({
      summary: "A grounded summary.",
      keyRisks: [],
      confidence: "medium",
      evidence: [],
    })).toThrow();
  });

  it("rejects over-length rationale explanations", () => {
    expect(() => RationaleOutputSchema.parse({
      rationales: [{
        template: "product",
        strategy: "ISR",
        explanation: "x".repeat(281),
        evidence: [{ signal: "A real finding" }],
      }],
    })).toThrow();
  });
});
