import { generateText, Output } from "ai";
import type { Report } from "../analyse/schemas";
import { ExecutiveSummarySchema } from "./schemas";
import { AI_OUTPUT_LIMITS, evidenceExists } from "./guardrails";
import { reportToRuleFindings } from "./findings";
import { generateValidatedOutput } from "./generation";
import { resolveAIModel } from "./model";
import { AI_SYSTEM_PROMPT, buildExecutiveSummaryPrompt } from "./prompts";

export { reportToRuleFindings };

export async function enrichReportWithSummary(report: Report): Promise<Report> {
  try {
    const resolved = resolveAIModel();
    if (!resolved.enabled) return report;

    const findings = reportToRuleFindings(report);
    if (findings.findings.length === 0) return report;

    const summary = await generateValidatedOutput(
      async (prompt) => {
        const result = await generateText({
          model: resolved.model,
          output: Output.object({ schema: ExecutiveSummarySchema }),
          system: AI_SYSTEM_PROMPT,
          prompt,
          maxOutputTokens: AI_OUTPUT_LIMITS.summary,
          maxRetries: 0,
          abortSignal: AbortSignal.timeout(25_000),
        });
        return ExecutiveSummarySchema.parse(result.output);
      },
      buildExecutiveSummaryPrompt(findings),
      (output) => evidenceExists(output.evidence, findings),
      "Executive summary cited evidence not present in the report findings.",
    );

    return {
      ...report,
      ai: {
        ...report.ai,
        summary,
        model: resolved.modelId,
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown provider error.";
    console.error(`AI executive summary unavailable: ${reason}`);
    return report;
  }
}
