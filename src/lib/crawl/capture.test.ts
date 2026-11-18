import { describe, expect, it } from "vitest";
import { normalizeJsonLd } from "./capture";

describe("normalizeJsonLd", () => {
  it("keeps object JSON-LD records", () => {
    expect(normalizeJsonLd([{ "@type": "Product" }])).toEqual([
      { "@type": "Product" },
    ]);
  });

  it("flattens array JSON-LD records", () => {
    expect(normalizeJsonLd([
      [{ "@type": "Organization" }, { "@type": "WebSite" }],
      null,
      "invalid",
    ])).toEqual([
      { "@type": "Organization" },
      { "@type": "WebSite" },
    ]);
  });
});
