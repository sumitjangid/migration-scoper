import { describe, expect, it } from "vitest";
import fixture from "./fixtures/rule-findings.json";
import { RuleFindingsSchema } from "./schemas";
import {
  evidenceExists,
  evidenceSignals,
  trimRuleFindings,
  validateRationaleStrategies,
} from "./guardrails";

const findings = RuleFindingsSchema.parse(fixture);

describe("AI guardrails", () => {
  it("trims findings to the configured limit", () => {
    expect(trimRuleFindings(findings, 2).findings).toHaveLength(2);
  });

  it("accepts evidence that maps to a real finding", () => {
    const evidence = [{ template: "product", signal: "Product page: 0 JSON-LD blocks in raw HTML." }];
    expect(evidenceExists(evidence, findings)).toBe(true);
  });

  it("accepts a verbatim evidence excerpt attributed to its template", () => {
    expect(evidenceExists([{
      template: "product",
      signal: "0 JSON-LD blocks in raw HTML.",
    }], findings)).toBe(true);
  });

  it("rejects evidence that is not in RuleFindings", () => {
    expect(evidenceExists([{ signal: "Invented claim" }], findings)).toBe(false);
  });

  it("rejects evidence attributed to the wrong template", () => {
    expect(evidenceExists([{
      template: "home",
      signal: "Product page: 0 JSON-LD blocks in raw HTML.",
    }], findings)).toBe(false);
  });

  it("provides a stable set of evidence signals", () => {
    expect(evidenceSignals(findings).size).toBeGreaterThan(0);
  });

  it("accepts matching strategies and rejects changed strategies", () => {
    expect(validateRationaleStrategies([
      { template: "product", strategy: "ISR" },
    ], findings)).toBe(true);
    expect(validateRationaleStrategies([
      { template: "product", strategy: "SSR" },
    ], findings)).toBe(false);
  });

  it("rejects duplicate or missing template rationales", () => {
    expect(validateRationaleStrategies([
      { template: "product", strategy: "ISR" },
      { template: "product", strategy: "ISR" },
    ], findings)).toBe(false);
    expect(validateRationaleStrategies([], findings)).toBe(false);
  });
});
