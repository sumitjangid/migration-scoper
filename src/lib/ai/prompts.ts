import type { RuleFindings } from "./schemas";

export const AI_SYSTEM_PROMPT =
  "You assist a Solutions Engineer scoping a migration to Vercel. Use only the provided findings. Do not invent facts, numbers, platforms, or customer details. If evidence is thin, say so. Return only the requested structured object, with no markdown fences or commentary.";

export function buildDiscoveryPrompt(findings: RuleFindings): string {
  return [
    "Return concise discovery questions about gaps the crawl could not observe.",
    "Focus on integrations, checkout, search, catalog, promotions, auth, SEO, and data volume.",
    "Return exactly 5 questions in the questions array.",
    "Keep each question and its reason short.",
    "For every evidence entry, copy the signal and template values exactly from one provided finding. Do not paraphrase or add a prefix to the signal.",
    "Return one JSON object only.",
    "",
    JSON.stringify(findings),
  ].join("\n");
}

export function buildRationalePrompt(findings: RuleFindings): string {
  return [
    "Write a short plain-language explanation for each template rendering recommendation.",
    "Do not choose or change the strategy. Copy the strategy from the finding for each template.",
    "Every rationale must cite at least one provided evidence entry by copying its signal and template values exactly.",
    "Return one JSON object only.",
    "",
    JSON.stringify(findings),
  ].join("\n");
}

export function buildExecutiveSummaryPrompt(findings: RuleFindings): string {
  return [
    "Write a 3-5 sentence executive summary for a non-technical stakeholder.",
    "State overall complexity, top risks, and what is unknown.",
    "Include at least one evidence entry copied exactly from the findings. Copy its signal and template values exactly; do not paraphrase or add a prefix to the signal.",
    "Do not add marketing language or unsupported numbers.",
    "Return one JSON object only.",
    "",
    JSON.stringify(findings),
  ].join("\n");
}
