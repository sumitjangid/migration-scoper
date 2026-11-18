import { z } from "zod";

export const PlatformSchema = z.object({
  name: z.enum(["Magento", "Hybris", "Shopify", "Unknown"]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
});

export const CapturedPageSchema = z.object({
  url: z.string().url(),
  template: z.enum(["home", "category", "product", "search", "cart", "content"]),
  rawHtml: z.string(),
  renderedHtml: z.string(),
  status: z.number(),
  headers: z.record(z.string(), z.string()),
  networkRequests: z.array(z.object({
    url: z.string(),
    resourceType: z.string(),
  })),
  jsonLd: z.array(z.record(z.string(), z.unknown())),
  scriptCount: z.number().int().nonnegative(),
  scriptBytes: z.number().int().nonnegative(),
  capturedAt: z.string().datetime(),
});

export const CrawlResultSchema = z.object({
  requestedUrl: z.string().url(),
  finalUrl: z.string().url(),
  platform: PlatformSchema,
  pages: z.array(CapturedPageSchema),
  robotsAllowed: z.boolean(),
  robotsNote: z.string(),
  warnings: z.array(z.string()),
  crawledAt: z.string().datetime(),
});

export type Platform = z.infer<typeof PlatformSchema>;
export type CapturedPage = z.infer<typeof CapturedPageSchema>;
export type CrawlResult = z.infer<typeof CrawlResultSchema>;
