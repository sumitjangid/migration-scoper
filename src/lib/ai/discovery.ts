import { generateText, Output } from "ai";
import type { Report } from "../analyse/schemas";
import { AI_OUTPUT_LIMITS, evidenceExists } from "./guardrails";
import { reportToRuleFindings } from "./findings";
import { generateValidatedOutput } from "./generation";
import { resolveAIModel } from "./model";
import { AI_SYSTEM_PROMPT, buildDiscoveryPrompt } from "./prompts";
import { DiscoveryOutputSchema } from "./schemas";

export async function enrichReportWithDiscoveryQuestions(report: Report): Promise<Report> {
  try {
    const resolved = resolveAIModel();
    if (!resolved.enabled) return report;

    const findings = reportToRuleFindings(report);
    if (!findings.findings.some((finding) => finding.kind === "unknown" || finding.kind === "risk")) {
      return report;
    }

    const output = await generateValidatedOutput(
      async (prompt) => {
        const result = await generateText({
          model: resolved.model,
          output: Output.object({ schema: DiscoveryOutputSchema }),
          system: AI_SYSTEM_PROMPT,
          prompt,
          maxOutputTokens: AI_OUTPUT_LIMITS.discovery,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(25_000),
        });
        return DiscoveryOutputSchema.parse(result.output);
      },
      buildDiscoveryPrompt(findings),
      (result) => result.questions.every((question) => evidenceExists(question.evidence, findings)),
      "Generated discovery question cited evidence not present in the report findings.",
    );

    return {
      ...report,
      ai: {
        ...report.ai,
        questions: output.questions,
        model: resolved.modelId,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown provider error.";
    console.error(`AI discovery questions unavailable: ${reason}`);
    return report;
  }
}
