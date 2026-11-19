import type { Report } from "../analyse/schemas";
import { RuleFindingsSchema, type Evidence, type RuleFindings } from "./schemas";
import { trimRuleFindings } from "./guardrails";

const maxEvidenceLength = 300;

function toEvidence(values: string[], template?: string): Evidence[] {
  return values.map((signal) => ({
    signal: signal.slice(0, maxEvidenceLength),
    ...(template ? { template } : {}),
  }));
}

export function reportToRuleFindings(report: Report): RuleFindings {
  const findings: RuleFindings["findings"] = [];

  if (report.platform.evidence.length > 0) {
    findings.push({
      kind: "platform",
      key: "platform",
      value: `${report.platform.name} (${Math.round(report.platform.confidence * 100)}% confidence)`,
      evidence: toEvidence(report.platform.evidence, "platform"),
    });
  }

  for (const template of report.templates) {
    if (template.evidence.length === 0) continue;
    findings.push({
      kind: "template",
      key: template.template,
      value: template.strategy,
      evidence: toEvidence(template.evidence, template.template),
    });
  }

  for (const risk of report.risks) {
    if (risk.evidence.length === 0) continue;
    findings.push({
      kind: "risk",
      key: risk.category,
      value: `${risk.title} (${risk.severity})`,
      evidence: toEvidence(risk.evidence),
    });
  }

  const unknowns = [...report.assumptionsAndUnknowns, ...report.estimate.assumptions]
    .slice(0, 20)
    .map((assumption) => assumption.slice(0, maxEvidenceLength));
  unknowns.forEach((assumption, index) => {
    findings.push({
      kind: "unknown",
      key: `unknown-${index}`,
      value: assumption,
      evidence: [{ signal: assumption, template: "crawl" }],
    });
  });

  return RuleFindingsSchema.parse(trimRuleFindings({
    requestedUrl: report.requestedUrl,
    findings,
    assumptions: unknowns,
  }));
}
