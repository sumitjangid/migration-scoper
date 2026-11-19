import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { generateValidatedOutput } from "./generation";

describe("validated AI generation", () => {
  it("retries a schema failure once with stricter instructions", async () => {
    const generate = vi.fn(async (prompt: string): Promise<{ grounded: boolean }> => ({
      grounded: prompt.includes("previous response failed validation"),
    })).mockRejectedValueOnce(new ZodError([]));

    await expect(generateValidatedOutput(
      generate,
      "Original prompt",
      (output) => output.grounded,
      "Evidence did not match.",
    )).resolves.toEqual({ grounded: true });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0]?.[0]).toBe("Original prompt");
    expect(generate.mock.calls[1]?.[0]).toContain("copy evidence fields verbatim");
  });

  it("does not retry provider errors", async () => {
    const generate = vi.fn().mockRejectedValue(new Error("provider unavailable"));

    await expect(generateValidatedOutput(
      generate,
      "Original prompt",
      () => true,
      "Evidence did not match.",
    )).rejects.toThrow("provider unavailable");

    expect(generate).toHaveBeenCalledOnce();
  });
});
