import { afterEach, describe, expect, it, vi } from "vitest";
import type { Report } from "../analyse/schemas";
import { enrichReportWithAI } from "./index";

const { mockDiscovery, mockRationales, mockSummary } = vi.hoisted(() => ({
  mockDiscovery: vi.fn(),
  mockRationales: vi.fn(),
  mockSummary: vi.fn(),
}));

vi.mock("./discovery", () => ({ enrichReportWithDiscoveryQuestions: mockDiscovery }));
vi.mock("./rationale", () => ({ enrichReportWithRationales: mockRationales }));
vi.mock("./summary", () => ({ enrichReportWithSummary: mockSummary }));

function report(): Report {
  return {
    requestedUrl: "https://example.com",
    platform: { name: "Unknown", confidence: 0, evidence: [] },
    templates: [],
    risks: [],
    estimate: {
      tshirtSize: "S",
      effortRangeWeeks: { min: 2, max: 4 },
      vercelUsageRangeUsdMonthly: { min: 0, max: 0 },
      assumptions: [],
    },
    discoveryQuestions: [],
    phasedOutline: [],
    assumptionsAndUnknowns: [],
    analyzedAt: "2026-01-01T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  mockDiscovery.mockReset();
  mockRationales.mockReset();
  mockSummary.mockReset();
});

describe("AI report enrichment", () => {
  it("keeps successful sections when another independent AI call fails", async () => {
    const original = report();
    const questions = [{
      question: "Which systems provide inventory?",
      why: "The crawl cannot observe backend ownership.",
      category: "integrations" as const,
      evidence: [{ signal: "Backend behavior is unknown." }],
    }];
    const rationales = [{
      template: "product" as const,
      strategy: "ISR" as const,
      explanation: "Revalidate catalog content.",
      evidence: [{ signal: "Catalog content changes.", template: "product" }],
    }];
    mockDiscovery.mockResolvedValue({
      ...original,
      ai: { questions, model: "openai/test-model", generatedAt: "2026-01-01T00:00:00.000Z" },
    });
    mockRationales.mockResolvedValue({
      ...original,
      ai: { rationales, model: "openai/test-model", generatedAt: "2026-01-01T00:00:00.000Z" },
    });
    mockSummary.mockRejectedValue(new Error("provider unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await enrichReportWithAI(original);

    expect(mockDiscovery).toHaveBeenCalledOnce();
    expect(mockRationales).toHaveBeenCalledOnce();
    expect(mockSummary).toHaveBeenCalledOnce();
    expect(result.ai?.questions).toEqual(questions);
    expect(result.ai?.rationales).toEqual(rationales);
    expect(result.ai?.summary).toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it("returns the original report when all AI calls fail", async () => {
    mockDiscovery.mockRejectedValue(new Error("discovery unavailable"));
    mockRationales.mockRejectedValue(new Error("rationale unavailable"));
    mockSummary.mockRejectedValue(new Error("summary unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = report();

    await expect(enrichReportWithAI(original)).resolves.toBe(original);
  });
});
