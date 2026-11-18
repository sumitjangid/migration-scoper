import { z } from "zod";

export const TemplateAnalysisSchema = z.object({
  template: z.enum(["home", "category", "product", "search", "cart", "content"]),
  strategy: z.enum(["static", "ISR", "PPR", "SSR"]),
  rationale: z.string(),
  evidence: z.array(z.string()),
  assumption: z.boolean(),
});

export const RiskSchema = z.object({
  id: z.string(),
  category: z.enum(["seo", "redirect", "structured-data", "scripts", "checkout", "crawler-visibility"]),
  title: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  evidence: z.array(z.string()),
  assumption: z.boolean(),
});

export const EstimateSchema = z.object({
  tshirtSize: z.enum(["XS", "S", "M", "L", "XL"]),
  effortRangeWeeks: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }).refine((range) => range.max >= range.min),
  vercelUsageRangeUsdMonthly: z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
  }).refine((range) => range.max >= range.min),
  assumptions: z.array(z.string()),
});

export const DiscoveryQuestionSchema = z.object({
  topic: z.string(),
  question: z.string(),
  reason: z.string(),
});

export const ReportSchema = z.object({
  requestedUrl: z.string().url(),
  platform: z.object({
    name: z.enum(["Magento", "Hybris", "Shopify", "Unknown"]),
    confidence: z.number().min(0).max(1),
    evidence: z.array(z.string()),
  }),
  templates: z.array(TemplateAnalysisSchema),
  risks: z.array(RiskSchema),
  estimate: EstimateSchema,
  discoveryQuestions: z.array(DiscoveryQuestionSchema),
  phasedOutline: z.array(z.object({
    phase: z.string(),
    summary: z.string(),
  })),
  assumptionsAndUnknowns: z.array(z.string()),
  analyzedAt: z.string().datetime(),
});

export type TemplateAnalysis = z.infer<typeof TemplateAnalysisSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type Estimate = z.infer<typeof EstimateSchema>;
export type DiscoveryQuestion = z.infer<typeof DiscoveryQuestionSchema>;
export type Report = z.infer<typeof ReportSchema>;
