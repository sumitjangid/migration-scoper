import { afterEach, describe, expect, it, vi } from "vitest";
import type { Report } from "../analyse/schemas";
import { enrichReportWithDiscoveryQuestions } from "./discovery";

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

const questions = Array.from({ length: 5 }, (_, index) => ({
  question: `Which backend detail should be confirmed, item ${index + 1}?`,
  why: "The public crawl does not expose backend behavior.",
  category: "integrations" as const,
  evidence: [{ signal: "Backend behavior is unknown.", template: "crawl" }],
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  mockGenerateText.mockReset();
});

describe("AI discovery questions", () => {
  it("attaches questions only when every question cites real evidence", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockResolvedValue({ output: { questions } });

    const result = await enrichReportWithDiscoveryQuestions(report());

    expect(result.ai?.model).toBe("openai/test-model");
    expect(result.ai?.questions).toHaveLength(5);
    expect(result.ai?.questions?.[0]?.evidence[0]?.signal).toBe("Backend behavior is unknown.");
  });

  it("retries once when the structured response cannot be parsed", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText
      .mockRejectedValueOnce(Object.assign(new Error("No object generated."), { name: "AI_NoObjectGeneratedError" }))
      .mockResolvedValueOnce({ output: { questions } });

    const result = await enrichReportWithDiscoveryQuestions(report());

    expect(result.ai?.questions).toHaveLength(5);
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(mockGenerateText.mock.calls[1]?.[0].prompt).toContain("Your previous response failed validation.");
  });

  it("preserves the deterministic report when a question cites unknown evidence", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockResolvedValue({
      output: {
        questions: questions.map((question, index) => ({
          ...question,
          evidence: index === 0 ? [{ signal: "Unobserved checkout provider." }] : question.evidence,
        })),
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = report();

    await expect(enrichReportWithDiscoveryQuestions(original)).resolves.toBe(original);
    expect(console.error).toHaveBeenCalled();
  });

  it("returns the unchanged deterministic report while AI is disabled", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const original = report();

    await expect(enrichReportWithDiscoveryQuestions(original)).resolves.toBe(original);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });
});
