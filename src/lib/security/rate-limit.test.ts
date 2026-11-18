import { afterEach, describe, expect, it, vi } from "vitest";
import { enforceScopeRateLimit } from "./rate-limit";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("scope rate limit", () => {
  it("limits repeated crawls from one client in development", async () => {
    const address = "203.0.113.41";
    await enforceScopeRateLimit(address);
    await enforceScopeRateLimit(address);
    await enforceScopeRateLimit(address);
    await expect(enforceScopeRateLimit(address)).rejects.toMatchObject({
      status: 429,
    });
  });

  it("fails closed in production when the shared limiter is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");

    await expect(enforceScopeRateLimit("203.0.113.42")).rejects.toMatchObject({
      status: 503,
    });
  });

  it("uses the shared limiter in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify([{ result: [1, 1] }]),
      { headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(enforceScopeRateLimit("203.0.113.43")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://redis.example/pipeline",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
