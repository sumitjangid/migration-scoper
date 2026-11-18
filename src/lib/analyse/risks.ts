import type { CapturedPage } from "../crawl/types";
import type { Risk } from "./schemas";

export function analyseRisks(pages: CapturedPage[]): Risk[] {
  const risks: Risk[] = [];

  for (const page of pages) {
    const rawText = page.rawHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").length;
    const renderedText = page.renderedHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").length;
    if (renderedText > rawText * 1.25) {
      risks.push({
        id: `crawler-visibility-${page.url}`,
        category: "crawler-visibility",
        title: `Content may be less visible before JavaScript rendering on ${page.template}`,
        severity: "high",
        evidence: [`Raw text signal ${rawText}; rendered text signal ${renderedText} for ${page.url}.`],
        assumption: false,
      });
    }

    if (!/<link[^>]+rel=["']canonical["']/i.test(page.rawHtml) && !/<link[^>]+rel=["']canonical["']/i.test(page.renderedHtml)) {
      risks.push({
        id: `canonical-${page.url}`,
        category: "seo",
        title: `Canonical link not observed on ${page.template}`,
        severity: "medium",
        evidence: [`Neither captured HTML source contains a canonical link for ${page.url}.`],
        assumption: false,
      });
    }

    if (page.jsonLd.length === 0) {
      risks.push({
        id: `structured-data-${page.url}`,
        category: "structured-data",
        title: `No JSON-LD structured data observed on ${page.template}`,
        severity: "medium",
        evidence: [`No application/ld+json objects were captured for ${page.url}.`],
        assumption: false,
      });
    }

    if (page.scriptBytes > 1_000_000 || page.scriptCount > 20) {
      risks.push({
        id: `scripts-${page.url}`,
        category: "scripts",
        title: `Third-party or client script weight may be significant on ${page.template}`,
        severity: "medium",
        evidence: [`${page.scriptCount} script elements and ${page.scriptBytes} bytes of captured script content.`],
        assumption: false,
      });
    }
  }

  if (pages.some((page) => page.template === "cart")) {
    risks.push({
      id: "checkout-boundary",
      category: "checkout",
      title: "Checkout boundary requires integration discovery",
      severity: "high",
      evidence: ["A cart template was captured."],
      assumption: true,
    });
  }

  return risks;
}
