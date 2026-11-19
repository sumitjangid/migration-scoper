import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeAIReportQuota } from "./ai-rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI report quota", () => {
  it("allows up to the configured per-IP daily report count in development", async () => {
    vi.stubEnv("AI_MAX_REPORTS_PER_IP_PER_DAY", "2");
    const address = "203.0.113.61";

    await expect(consumeAIReportQuota(address)).resolves.toBe(true);
    await expect(consumeAIReportQuota(address)).resolves.toBe(true);
    await expect(consumeAIReportQuota(address)).resolves.toBe(false);
  });

  it("rejects invalid quota configuration", async () => {
    vi.stubEnv("AI_MAX_REPORTS_PER_IP_PER_DAY", "0");

    await expect(consumeAIReportQuota("203.0.113.62")).rejects.toThrow(
      "AI report quota is not configured correctly.",
    );
  });

  it("uses the shared Redis limiter in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ result: 1 }]),
      { headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(consumeAIReportQuota("203.0.113.63")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://redis.example/pipeline",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("fails closed when the shared limiter is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(consumeAIReportQuota("203.0.113.64")).rejects.toThrow(
      "AI report quota is not configured.",
    );
  });
});
