# Build Plan (context for VS Code Copilot)

Paste or reference this file when prompting Copilot. Build in the order below and keep each step shippable.

## Instructions for Copilot
- Stack: Next.js App Router, TypeScript, Vercel AI SDK, Playwright, Zod, Tailwind.
- Use structured output (`generateObject` or equivalent) with Zod schemas for all LLM results. No free-text parsing.
- Keep the crawler and the analysis in separate modules with a typed boundary (`CrawlResult`).
- Every recommendation must cite evidence from the crawl or be marked `assumption: true`.
- Never fabricate numbers. Cost and effort are ranges with listed assumptions.
- Respect robots.txt, limit concurrency, set a crawl timeout.
- Small, reviewable commits. Write a test for each schema and each detector.

## Suggested structure
```
src/
  app/
    page.tsx                 # URL input
    report/[id]/page.tsx     # report view
    api/scope/route.ts       # starts crawl + analysis
  lib/
    crawl/
      discover.ts            # find representative templates
      capture.ts             # Playwright capture per URL
      detect-platform.ts     # Magento / Hybris / Shopify signals
      types.ts               # CrawlResult
    analyse/
      schemas.ts             # Zod: TemplateAnalysis, Risk, Estimate, Report
      rendering.ts           # strategy per template
      risks.ts               # SEO, redirects, scripts, AI-crawler visibility
      estimate.ts            # ranges + assumptions
      questions.ts           # discovery questions
    report/
      render.tsx             # report components
      markdown.ts            # Markdown export
```

## Milestones

### M1: Crawl 
- Playwright captures for a given URL: raw HTML, rendered HTML, network requests, response headers, JSON-LD, script count and weight.
- `discover.ts` picks 6-8 templates by following nav links and heuristics (category, product, search, cart).
- `detect-platform.ts` returns platform plus confidence from known signals (e.g. Magento static paths, Hybris `/yacceleratorstorefront`-style paths, Shopify `cdn.shopify.com` and theme markers).
- Done when: a CLI script prints a `CrawlResult` JSON for 3 sites.

### M2: Analysis
- Define Zod schemas first.
- Rendering recommendation per template using: content volatility, personalisation, catalog size, whether content is client-rendered.
- Risk register: raw-versus-rendered diff, canonical and structured-data checks, third-party script weight, checkout boundary.
- Estimate: t-shirt size plus Vercel usage range from optional traffic and catalog inputs.
- Discovery questions: generated from what the crawl could not observe.
- Done when: one command turns a `CrawlResult` into a validated `Report`.

### M3: UI 
- URL form, progress state, report page, Markdown export.
- Clear "assumptions and unknowns" section.

### M4: Ship
- Deploy to Vercel, add Deploy button, `.env.example`.
- Run on 3-5 public storefronts and save sample reports in `/examples`.
- Architecture write-up and 2-3 minute demo video.

## Prompting tips
- Start each Copilot session with: "Read BUILD_PLAN.md and PRODUCT.md. We are on milestone Mx."
- Ask for schemas and types before implementations.
- Ask it to write the test first for detectors.

## Risks to watch
- Bot protection blocking the crawler: fall back gracefully and say so in the report.
- Timeouts on Vercel functions: run the crawl in a background job or stream progress.
- Overconfident LLM output: enforce the evidence-or-assumption rule in the schema.
- Legal and ethical: only scan public pages, respect robots.txt, rate limit.
