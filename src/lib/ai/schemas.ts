import { z } from "zod";

export const StrategySchema = z.enum(["static", "ISR", "PPR", "SSR"]);

export const EvidenceSchema = z.object({
  signal: z.string().min(1).max(300),
  template: z.string().optional(),
});

export const RuleFindingSchema = z.object({
  kind: z.enum(["platform", "template", "risk", "estimate", "unknown"]),
  key: z.string().min(1).max(100),
  value: z.unknown(),
  evidence: z.array(EvidenceSchema).min(1),
});

export const RuleFindingsSchema = z.object({
  requestedUrl: z.string().url(),
  findings: z.array(RuleFindingSchema),
  assumptions: z.array(z.string()).max(20),
});

export const DiscoveryQuestionSchema = z.object({
  question: z.string().min(1).max(200),
  why: z.string().min(1).max(200),
  category: z.enum(["integrations", "checkout", "search", "catalog", "seo", "auth", "other"]),
  evidence: z.array(EvidenceSchema).min(1),
});

export const DiscoveryOutputSchema = z.object({
  questions: z.array(DiscoveryQuestionSchema).min(5).max(10),
});

export const RationaleSchema = z.object({
  template: z.string().min(1).max(50),
  strategy: StrategySchema,
  explanation: z.string().min(1).max(280),
  evidence: z.array(EvidenceSchema).min(1),
});

export const RationaleOutputSchema = z.object({
  rationales: z.array(RationaleSchema).min(1),
});

export const ExecutiveSummarySchema = z.object({
  summary: z.string().min(1).max(900),
  keyRisks: z.array(z.string().min(1).max(160)).max(3),
  confidence: z.enum(["low", "medium", "high"]),
  evidence: z.array(EvidenceSchema).min(1),
});

export type Evidence = z.infer<typeof EvidenceSchema>;
export type RuleFinding = z.infer<typeof RuleFindingSchema>;
export type RuleFindings = z.infer<typeof RuleFindingsSchema>;
export type DiscoveryQuestion = z.infer<typeof DiscoveryQuestionSchema>;
export type DiscoveryOutput = z.infer<typeof DiscoveryOutputSchema>;
export type Rationale = z.infer<typeof RationaleSchema>;
export type RationaleOutput = z.infer<typeof RationaleOutputSchema>;
export type ExecutiveSummary = z.infer<typeof ExecutiveSummarySchema>;
