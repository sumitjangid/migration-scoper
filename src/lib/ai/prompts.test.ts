import { describe, expect, it } from "vitest";
import fixture from "./fixtures/rule-findings.json";
import { RuleFindingsSchema } from "./schemas";
import {
  buildDiscoveryPrompt,
  buildExecutiveSummaryPrompt,
  buildRationalePrompt,
} from "./prompts";

const findings = RuleFindingsSchema.parse(fixture);

describe("AI prompt builders", () => {
  it("builds stable prompts for fixed findings", () => {
    expect(buildDiscoveryPrompt(findings)).toContain(JSON.stringify(findings));
    expect(buildRationalePrompt(findings)).toContain("Do not choose or change the strategy.");
    expect(buildExecutiveSummaryPrompt(findings)).toContain("3-5 sentence executive summary");
  });

  it("does not include raw crawl data in prompts", () => {
    const prompt = [
      buildDiscoveryPrompt(findings),
      buildRationalePrompt(findings),
      buildExecutiveSummaryPrompt(findings),
    ].join("\n");

    expect(prompt).not.toContain("<html");
    expect(prompt).not.toContain("rawHtml");
  });
});
