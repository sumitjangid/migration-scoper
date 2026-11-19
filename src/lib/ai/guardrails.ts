import type { Evidence, RuleFindings } from "./schemas";

export const AI_OUTPUT_LIMITS = {
  discovery: 900,
  rationales: 800,
  summary: 300,
} as const;

export function trimRuleFindings(findings: RuleFindings, maxFindings = 40): RuleFindings {
  return {
    ...findings,
    findings: findings.findings.slice(0, maxFindings),
  };
}

export function evidenceSignals(findings: RuleFindings): Set<string> {
  const signals = new Set<string>();
  for (const finding of findings.findings) {
    for (const evidence of finding.evidence) {
      signals.add(evidence.signal);
      signals.add(evidenceSignal(evidence));
    }
  }
  return signals;
}

export function evidenceSignal(evidence: Evidence): string {
  return evidence.template ? `${evidence.template}: ${evidence.signal}` : evidence.signal;
}

export function evidenceExists(evidence: Evidence[], findings: RuleFindings): boolean {
  return evidence.length > 0 && evidence.every((item) =>
    findings.findings.some((finding) => finding.evidence.some((candidate) => {
      let signal = item.signal;
      if (item.template) {
        if (candidate.template !== item.template) return false;
        const prefix = `${item.template}: `;
        if (signal.startsWith(prefix)) signal = signal.slice(prefix.length);
      }
      return candidate.signal === signal
        || evidenceSignal(candidate) === item.signal
        || (signal.length >= 12 && candidate.signal.includes(signal));
    })),
  );
}

export function validateRationaleStrategies(
  rationales: Array<{ template: string; strategy: string }>,
  findings: RuleFindings,
): boolean {
  const ruleStrategies = new Map(
    findings.findings
      .filter((finding) => finding.kind === "template")
      .map((finding) => [
        String(finding.key),
        String(finding.value),
      ]),
  );

  if (rationales.length !== ruleStrategies.size) return false;

  const seenTemplates = new Set<string>();
  return rationales.every((rationale) => {
    const ruleStrategy = ruleStrategies.get(rationale.template);
    if (ruleStrategy === undefined || ruleStrategy !== rationale.strategy || seenTemplates.has(rationale.template)) {
      return false;
    }
    seenTemplates.add(rationale.template);
    return true;
  });
}
