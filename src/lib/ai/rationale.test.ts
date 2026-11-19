import { afterEach, describe, expect, it, vi } from "vitest";
import type { Report } from "../analyse/schemas";
import { enrichReportWithRationales } from "./rationale";

const { mockGenerateText } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: mockGenerateText,
  Output: { object: vi.fn(({ schema }) => ({ schema })) },
  gateway: vi.fn((modelId: string) => ({ modelId })),
  NoObjectGeneratedError: {
    isInstance: (error: unknown) => error instanceof Error && error.name === "AI_NoObjectGeneratedError",
  },
}));

function report(): Report {
  return {
    requestedUrl: "https://example.com",
    platform: { name: "Shopify", confidence: 0.9, evidence: ["Shopify asset path observed."] },
    templates: [{
      template: "product",
      strategy: "ISR",
      rationale: "Catalog content can benefit from controlled revalidation.",
      evidence: ["Template is classified as product."],
      assumption: true,
    }],
    risks: [],
    estimate: {
      tshirtSize: "S",
      effortRangeWeeks: { min: 2, max: 4 },
      vercelUsageRangeUsdMonthly: { min: 150, max: 400 },
      assumptions: ["Monthly traffic is unknown."],
    },
    discoveryQuestions: [],
    phasedOutline: [],
    assumptionsAndUnknowns: ["Backend behavior is unknown."],
    analyzedAt: "2026-01-01T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  mockGenerateText.mockReset();
});

describe("AI rendering rationales", () => {
  it("attaches evidence-backed rationales only when their strategies match the rules", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockResolvedValue({
      output: {
        rationales: [{
          template: "product",
          strategy: "ISR",
          explanation: "Revalidate catalog content while serving a cached page.",
          evidence: [{ signal: "Template is classified as product.", template: "product" }],
        }],
      },
    });

    const result = await enrichReportWithRationales(report());

    expect(result.ai?.model).toBe("openai/test-model");
    expect(result.ai?.rationales?.[0]?.strategy).toBe("ISR");
    expect(result.ai?.rationales?.[0]?.evidence[0]?.template).toBe("product");
  });

  it("preserves the deterministic report when a generated strategy differs", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockResolvedValue({
      output: {
        rationales: [{
          template: "product",
          strategy: "SSR",
          explanation: "Render every request dynamically.",
          evidence: [{ signal: "Template is classified as product.", template: "product" }],
        }],
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = report();

    await expect(enrichReportWithRationales(original)).resolves.toBe(original);
    expect(console.error).toHaveBeenCalled();
  });

  it("preserves the deterministic report when generated evidence is unknown", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockResolvedValue({
      output: {
        rationales: [{
          template: "product",
          strategy: "ISR",
          explanation: "Revalidate catalog content while serving a cached page.",
          evidence: [{ signal: "Unobserved product traffic." }],
        }],
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = report();

    await expect(enrichReportWithRationales(original)).resolves.toBe(original);
    expect(console.error).toHaveBeenCalled();
  });

  it("returns the unchanged deterministic report while AI is disabled", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const original = report();

    await expect(enrichReportWithRationales(original)).resolves.toBe(original);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
