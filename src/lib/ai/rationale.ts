import { generateText, Output } from "ai";
import type { Report } from "../analyse/schemas";
import { AI_OUTPUT_LIMITS, evidenceExists, validateRationaleStrategies } from "./guardrails";
import { reportToRuleFindings } from "./findings";
import { generateValidatedOutput } from "./generation";
import { resolveAIModel } from "./model";
import { AI_SYSTEM_PROMPT, buildRationalePrompt } from "./prompts";
import { RationaleOutputSchema } from "./schemas";

export async function enrichReportWithRationales(report: Report): Promise<Report> {
  try {
    const resolved = resolveAIModel();
    if (!resolved.enabled) return report;

    const findings = reportToRuleFindings(report);
    if (!findings.findings.some((finding) => finding.kind === "template")) return report;

    const output = await generateValidatedOutput(
      async (prompt) => {
        const result = await generateText({
          model: resolved.model,
          output: Output.object({ schema: RationaleOutputSchema }),
          system: AI_SYSTEM_PROMPT,
          prompt,
          maxOutputTokens: AI_OUTPUT_LIMITS.rationales,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(25_000),
        });
        return RationaleOutputSchema.parse(result.output);
      },
      buildRationalePrompt(findings),
      (result) =>
        validateRationaleStrategies(result.rationales, findings)
        && result.rationales.every((rationale) => evidenceExists(rationale.evidence, findings)),
      "Generated rationale did not match the deterministic strategy or report evidence.",
    );

    return {
      ...report,
      ai: {
        ...report.ai,
        rationales: output.rationales,
        model: resolved.modelId,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown provider error.";
    console.error(`AI rendering rationales unavailable: ${reason}`);
    return report;
  }
}
