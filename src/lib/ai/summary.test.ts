import { afterEach, describe, expect, it, vi } from "vitest";
import type { Report } from "../analyse/schemas";
import { enrichReportWithSummary, reportToRuleFindings } from "./summary";

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
    risks: [{
      id: "structured-data-example",
      category: "structured-data",
      title: "No structured data observed",
      severity: "medium",
      evidence: ["No JSON-LD objects were captured."],
      assumption: false,
    }],
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

describe("AI executive summary", () => {
  it("builds findings only from evidence-backed deterministic report fields", () => {
    const findings = reportToRuleFindings(report());

    expect(findings.findings.map((item) => item.kind)).toEqual([
      "platform",
      "template",
      "risk",
      "unknown",
      "unknown",
    ]);
    expect(findings.findings.flatMap((item) => item.evidence).map((item) => item.signal)).toContain(
      "No JSON-LD objects were captured.",
    );
    expect(findings.assumptions).toContain("Backend behavior is unknown.");
  });

  it("returns the unchanged deterministic report while AI is disabled", async () => {
    vi.stubEnv("AI_ENABLED", "false");
    const original = report();

    await expect(enrichReportWithSummary(original)).resolves.toBe(original);
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("attaches a summary only when its evidence matches the findings", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockResolvedValue({
      output: {
        summary: "The crawl found a product template and structured-data gap.",
        keyRisks: ["Structured data was not observed."],
        confidence: "medium",
        evidence: [{ signal: "No JSON-LD objects were captured." }],
      },
    });

    const result = await enrichReportWithSummary(report());

    expect(result.ai?.model).toBe("openai/test-model");
    expect(result.ai?.summary?.evidence[0]?.signal).toBe("No JSON-LD objects were captured.");
  });

  it("accepts a verbatim excerpt of a longer risk signal", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockResolvedValue({
      output: {
        summary: "The crawl observed a structured-data gap.",
        keyRisks: [],
        confidence: "medium",
        evidence: [{ signal: "JSON-LD objects were captured." }],
      },
    });

    const result = await enrichReportWithSummary(report());

    expect(result.ai?.summary?.evidence[0]?.signal).toBe("JSON-LD objects were captured.");
  });

  it("preserves the deterministic report when generation fails", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockRejectedValue(new Error("provider unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = report();

    await expect(enrichReportWithSummary(original)).resolves.toBe(original);
    expect(console.error).toHaveBeenCalled();
  });

  it("preserves the deterministic report when generated evidence is unknown", async () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_MODEL", "openai/test-model");
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    mockGenerateText.mockResolvedValue({
      output: {
        summary: "An unsupported summary.",
        keyRisks: [],
        confidence: "low",
        evidence: [{ signal: "Evidence that does not exist." }],
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const original = report();

    await expect(enrichReportWithSummary(original)).resolves.toBe(original);
    expect(console.error).toHaveBeenCalled();
  });
});
