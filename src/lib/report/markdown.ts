import type { Report } from "../analyse/schemas";

export function renderMarkdown(report: Report): string {
  const templateRows = report.templates.map((item) =>
    `| ${item.template} | ${item.strategy} | ${item.rationale} | ${item.assumption ? "Yes" : "No"} |`,
  ).join("\n");
  const riskRows = report.risks.map((risk) =>
    `| ${risk.category} | ${risk.title} | ${risk.severity} | ${risk.assumption ? "Assumption" : risk.evidence.join("; ")} |`,
  ).join("\n");
  const questions = report.discoveryQuestions.map((item) => `- **${item.topic}:** ${item.question}`).join("\n");
  const unknowns = report.assumptionsAndUnknowns.map((item) => `- ${item}`).join("\n");
  const aiSummary = report.ai?.summary;
  const aiRationales = report.ai?.rationales ?? [];
  const aiQuestions = report.ai?.questions ?? [];

  return `# Migration scope report

**Requested URL:** ${report.requestedUrl}
**Platform:** ${report.platform.name} (${Math.round(report.platform.confidence * 100)}% confidence)
**T-shirt size:** ${report.estimate.tshirtSize}
**Effort:** ${report.estimate.effortRangeWeeks.min}-${report.estimate.effortRangeWeeks.max} weeks
**Estimated Vercel usage:** $${report.estimate.vercelUsageRangeUsdMonthly.min}-$${report.estimate.vercelUsageRangeUsdMonthly.max} per month

${aiSummary ? `## AI-generated executive summary

${aiSummary.summary}

**Confidence:** ${aiSummary.confidence}
**Model:** ${report.ai?.model}
**Evidence:** ${aiSummary.evidence.map((item) => item.template ? `${item.template}: ${item.signal}` : item.signal).join("; ")}

${aiSummary.keyRisks.length > 0 ? `**Key risks:**\n${aiSummary.keyRisks.map((risk) => `- ${risk}`).join("\n")}\n` : ""}` : ""}
## Rendering recommendations

| Template | Strategy | Rationale | Assumption |
|---|---|---|---|
${templateRows}

${aiRationales.length > 0 ? `## AI-generated rendering rationales

${aiRationales.map((item) => `### ${item.template} (${item.strategy})

${item.explanation}

**Evidence:** ${item.evidence.map((evidence) => evidence.template ? `${evidence.template}: ${evidence.signal}` : evidence.signal).join("; ")}`).join("\n\n")}` : ""}

## Risks

| Category | Risk | Severity | Evidence |
|---|---|---|---|
${riskRows}

## Discovery questions

${questions}

${aiQuestions.length > 0 ? `## AI-generated discovery questions

${aiQuestions.map((item) => `- **${item.category}:** ${item.question}
  - Why: ${item.why}
  - Evidence: ${item.evidence.map((evidence) => evidence.template ? `${evidence.template}: ${evidence.signal}` : evidence.signal).join("; ")}`).join("\n")}` : ""}

## Assumptions and unknowns

${unknowns}

## Phased outline

${report.phasedOutline.map((phase) => `### ${phase.phase}\n${phase.summary}`).join("\n\n")}
`;
}
