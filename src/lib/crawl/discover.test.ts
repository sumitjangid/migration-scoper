import { describe, expect, it } from "vitest";
import { classifyUrl, isSensitiveUrl } from "./discover";

describe("crawl URL classification", () => {
  it("identifies cart and checkout paths as sensitive", () => {
    expect(isSensitiveUrl("https://example.com/cart")).toBe(true);
    expect(isSensitiveUrl("https://example.com/checkout/shipping")).toBe(true);
    expect(isSensitiveUrl("https://example.com/products/cart-organizer")).toBe(false);
  });

  it("preserves normal template classification", () => {
    expect(classifyUrl("https://example.com/products/item")).toBe("product");
  });
});
