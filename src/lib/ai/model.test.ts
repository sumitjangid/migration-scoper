import { describe, expect, it } from "vitest";
import { resolveAIModel } from "./model";

describe("AI model resolver", () => {
  it("returns disabled when the kill switch is off", () => {
    expect(resolveAIModel({ AI_ENABLED: "false" })).toEqual({
      enabled: false,
      reason: "AI is disabled.",
    });
  });

  it("requires provider/model format", () => {
    expect(resolveAIModel({
      AI_ENABLED: "true",
      AI_MODEL: "small-model",
      AI_GATEWAY_API_KEY: "test-key",
    })).toEqual({
      enabled: false,
      reason: "AI_MODEL must use provider/model format.",
    });
  });

  it("resolves a configured Gateway model without making a request", () => {
    const resolved = resolveAIModel({
      AI_ENABLED: "true",
      AI_MODEL: "openai/test-model",
      AI_GATEWAY_API_KEY: "test-key",
    });

    expect(resolved.enabled).toBe(true);
    if (resolved.enabled) {
      expect(resolved.modelId).toBe("openai/test-model");
      expect(resolved.model).toBeDefined();
    }
  });
});
