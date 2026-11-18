import type { CapturedPage } from "../crawl/types";
import type { TemplateAnalysis } from "./schemas";

export function analyseRendering(pages: CapturedPage[]): TemplateAnalysis[] {
  return pages.map((page) => {
    const rendered = page.renderedHtml.toLowerCase();
    const raw = page.rawHtml.toLowerCase();
    const renderedOnlyText = rendered.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").length;
    const rawText = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").length;
    const clientRendered = renderedOnlyText > rawText * 1.25;
    const volatile = ["search", "cart"].includes(page.template);

    if (page.template === "cart" || page.template === "search") {
      return {
        template: page.template,
        strategy: "SSR",
        rationale: "Dynamic, user-specific content or interaction suggests server rendering or client interaction at request time.",
        evidence: [`Template is classified as ${page.template}.`, "The page type is typically personalized or request-dependent."],
        assumption: true,
      };
    }
    if (clientRendered) {
      return {
        template: page.template,
        strategy: "PPR",
        rationale: "The rendered page contains substantially more visible text than the raw response, suggesting client-rendered content with a static shell opportunity.",
        evidence: [`Rendered text signal: ${renderedOnlyText}; raw text signal: ${rawText}.`],
        assumption: false,
      };
    }
    if (page.template === "category" || page.template === "product") {
      return {
        template: page.template,
        strategy: "ISR",
        rationale: "Catalog content can benefit from cached generation with controlled revalidation.",
        evidence: [`Template is classified as ${page.template}.`, "The raw response already includes substantial page text."],
        assumption: true,
      };
    }
    return {
      template: page.template,
      strategy: volatile ? "SSR" : "static",
      rationale: volatile
        ? "Dynamic content requires request-time rendering."
        : "The crawl shows substantial content in the raw HTML and no strong client-rendering signal.",
      evidence: [`Rendered text signal: ${renderedOnlyText}; raw text signal: ${rawText}.`],
      assumption: false,
    };
  });
}
