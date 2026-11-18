import type { Page } from "playwright";

export type TemplateType = "home" | "category" | "product" | "search" | "cart" | "content";

export interface TemplateCandidate {
  url: string;
  template: TemplateType;
}

const patterns: Array<[TemplateType, RegExp]> = [
  ["search", /\/(search|catalogsearch)(\/|$|\?)/i],
  ["cart", /\/(cart|basket|checkout\/cart)(\/|$|\?)/i],
  ["product", /\/(product|p|products?)\/|\/[^/]+\.html(?:$|\?)/i],
  ["category", /\/(category|categories|collection|collections|shop|catalog|c\/)[^/]*(\/|$)/i],
];

export function classifyUrl(url: string, isRoot = false): TemplateType {
  if (isRoot) return "home";
  for (const [template, pattern] of patterns) {
    if (pattern.test(url)) return template;
  }
  return "content";
}

export async function discoverTemplates(
  page: Page,
  startUrl: string,
  limit = 8,
): Promise<TemplateCandidate[]> {
  const origin = new URL(startUrl).origin;
  const candidates = new Map<string, TemplateCandidate>();
  candidates.set(startUrl, { url: startUrl, template: "home" });

  for (const anchor of await page.locator("a[href]").evaluateAll((links) =>
    links.map((link) => link.getAttribute("href")).filter((href): href is string => Boolean(href)),
  )) {
    let absolute: URL;
    try {
      absolute = new URL(anchor, startUrl);
    } catch {
      continue;
    }
    if (absolute.origin !== origin) continue;
    absolute.hash = "";
    if (["mailto:", "tel:"].includes(absolute.protocol)) continue;

    const url = absolute.toString();
    if (candidates.has(url)) continue;
    candidates.set(url, { url, template: classifyUrl(url) });
  }

  const ordered = [...candidates.values()].sort((a, b) => {
    const rank = (value: TemplateCandidate) =>
      ["home", "category", "product", "search", "cart", "content"].indexOf(value.template);
    return rank(a) - rank(b);
  });

  const selected = new Map<TemplateType, TemplateCandidate>();
  for (const candidate of ordered) {
    if (!selected.has(candidate.template) || candidate.template === "content") {
      selected.set(candidate.template, candidate);
    }
  }

  return [...selected.values()].slice(0, limit);
}
