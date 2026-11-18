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

  return `# Migration scope report

**Requested URL:** ${report.requestedUrl}
**Platform:** ${report.platform.name} (${Math.round(report.platform.confidence * 100)}% confidence)
**T-shirt size:** ${report.estimate.tshirtSize}
**Effort:** ${report.estimate.effortRangeWeeks.min}-${report.estimate.effortRangeWeeks.max} weeks
**Estimated Vercel usage:** $${report.estimate.vercelUsageRangeUsdMonthly.min}-$${report.estimate.vercelUsageRangeUsdMonthly.max} per month

## Rendering recommendations

| Template | Strategy | Rationale | Assumption |
|---|---|---|---|
${templateRows}

## Risks

| Category | Risk | Severity | Evidence |
|---|---|---|---|
${riskRows}

## Discovery questions

${questions}

## Assumptions and unknowns

${unknowns}

## Phased outline

${report.phasedOutline.map((phase) => `### ${phase.phase}\n${phase.summary}`).join("\n\n")}
`;
}
