import type { CapturedPage, Platform } from "./types";

export function detectPlatform(pages: CapturedPage[]): Platform {
  const evidence: string[] = [];
  let shopify = 0;
  let magento = 0;
  let hybris = 0;

  for (const page of pages) {
    const haystack = `${page.url}\n${page.headers["server"] ?? ""}\n${page.renderedHtml}`.toLowerCase();
    if (haystack.includes("cdn.shopify.com")) {
      shopify += 3;
      evidence.push("Shopify CDN marker");
    }
    if (/shopify-theme|shopify-section/.test(haystack)) {
      shopify += 2;
      evidence.push("Shopify theme marker");
    }
    if (/\/static\/version\d+\/|mage\/cookies|magento/.test(haystack)) {
      magento += 3;
      evidence.push("Magento static or client marker");
    }
    if (haystack.includes("x-magento-tags")) {
      magento += 2;
      evidence.push("Magento cache header");
    }
    if (page.url.toLowerCase().includes("yacceleratorstorefront") ||
        haystack.includes("/hybris/")) {
      hybris += 3;
      evidence.push("Hybris storefront path marker");
    }
  }

  const [name, score] = [
    ["Shopify", shopify],
    ["Magento", magento],
    ["Hybris", hybris],
  ].sort((a, b) => Number(b[1]) - Number(a[1]))[0];

  if (Number(score) === 0) {
    return { name: "Unknown", confidence: 0, evidence: [] };
  }

  return {
    name: name as Platform["name"],
    confidence: Math.min(1, Number(score) / 5),
    evidence: [...new Set(evidence)],
  };
}
