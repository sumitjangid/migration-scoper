import { afterEach, describe, expect, it, vi } from "vitest";
import { createRobotsPolicy, loadRobotsPolicy, RobotsPolicyError } from "./robots";

const origin = "https://example.com";
const publicResolver = async () => [{ address: "8.8.8.8", family: 4 }];

describe("robots policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the matching crawler group instead of the wildcard group", () => {
    const policy = createRobotsPolicy(origin, [
      "User-agent: *",
      "Disallow: /private",
      "User-agent: MigrationCopilotBot",
      "Disallow: /internal",
    ].join("\n"));

    expect(policy.check(`${origin}/private`).allowed).toBe(true);
    expect(policy.check(`${origin}/internal`).allowed).toBe(false);
  });

  it("prefers the most specific rule and lets Allow win ties", () => {
    const policy = createRobotsPolicy(origin, [
      "User-agent: *",
      "Disallow: /catalog/*",
      "Allow: /catalog/public$",
      "Disallow: /exact",
      "Allow: /exact",
    ].join("\n"));

    expect(policy.check(`${origin}/catalog/public`).allowed).toBe(true);
    expect(policy.check(`${origin}/catalog/private`).allowed).toBe(false);
    expect(policy.check(`${origin}/exact`).allowed).toBe(true);
  });

  it("parses crawl-delay and blocks URLs outside the checked origin", () => {
    const policy = createRobotsPolicy(origin, [
      "User-agent: MigrationCopilotBot",
      "Crawl-delay: 2.5",
    ].join("\n"));

    expect(policy.crawlDelaySeconds).toBe(2.5);
    expect(policy.check("https://other.example/path").allowed).toBe(false);
  });

  it("fails closed when robots.txt cannot be retrieved", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    await expect(loadRobotsPolicy(origin, publicResolver)).rejects.toThrow(RobotsPolicyError);
  });

  it("does not follow robots.txt redirects to local addresses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", {
      status: 302,
      headers: { location: "http://127.0.0.1/robots.txt" },
    })));

    await expect(loadRobotsPolicy(origin, publicResolver)).rejects.toThrow(RobotsPolicyError);
  });

  it("treats a missing robots.txt as no published restrictions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 404 })));

    const policy = await loadRobotsPolicy(origin, publicResolver);
    expect(policy.check(`${origin}/any-page`).allowed).toBe(true);
  });

  it("fails closed on server errors and denies all on access-restricted robots.txt", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(loadRobotsPolicy(origin, publicResolver)).rejects.toThrow(/HTTP 503/);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 403 })));
    const policy = await loadRobotsPolicy(origin, publicResolver);
    expect(policy.check(`${origin}/`).allowed).toBe(false);
  });
});
