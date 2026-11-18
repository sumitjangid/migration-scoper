# Migration Copilot

Pre-sales scoping for moving a legacy storefront (Magento, Hybris, Shopify theme) to Vercel.

Paste a storefront URL. Get a scoping report: rendering strategy per template, SEO and redirect risks, effort and cost ranges, discovery questions, and a phased outline.

> Status: in development. This README describes the intended design.

## What you get

| Section | Contents |
|---|---|
| Template inventory | Key page types found, detected platform |
| Rendering plan | Static / ISR / PPR / SSR per template, with rationale |
| Risk register | Redirects, canonicals, structured data, script weight, checkout boundary, AI-crawler visibility |
| Effort and cost | T-shirt sizes and a rough Vercel usage range, with assumptions |
| Discovery questions | What the crawl cannot see, for the customer call |
| Phased outline | Three high-level phases |

## How it works

1. **Crawl:** Playwright loads the URL, discovers 6-8 representative templates (home, category, product, search, cart, content), and captures rendered HTML, raw HTML, network requests, headers and structured data.
2. **Analyse:** Vercel AI SDK with structured output (Zod schemas) turns the captured signals into per-template recommendations and risks.
3. **Report:** a Next.js page renders the result, with a Markdown export.

The raw-versus-rendered HTML comparison is what flags content that non-JavaScript crawlers, including AI crawlers, cannot see.

## Stack
- Next.js (App Router)
- Vercel AI SDK
- Playwright
- Zod
- Deployed on Vercel

## Getting started

```bash
git clone <repo-url>
cd migration-copilot
pnpm install
cp .env.example .env.local   # add your model provider key
pnpm dev
```

Open http://localhost:3000 and paste a storefront URL.

## Crawl milestone

Run a public storefront crawl from the CLI:

```bash
npx playwright install chromium
pnpm crawl -- https://example.com
```

The command respects `robots.txt`, discovers representative templates, captures raw and rendered HTML, and prints a validated `CrawlResult` JSON document.

## Analysis milestone

Pipe a crawl result directly into the analysis command:

```bash
pnpm crawl -- https://example.com | pnpm analyse
```

Optional traffic and catalog inputs improve the estimate:

```bash
pnpm crawl -- https://example.com | pnpm analyse -- --traffic 500000 --catalog 10000
```

The command prints a validated `Report` JSON document. It does not write crawl or report data to disk.

## Limits
- It only sees the public front end. ERP, OMS, custom checkout, search and promotion logic are surfaced as discovery questions, not guessed.
- Estimates are ranges built on stated assumptions, not quotes.
- Crawls respect robots.txt and rate limits. Only scan sites you are allowed to scan.

## Roadmap
- Magento support first, then Shopify, then Hybris
- Exportable PDF report
- Comparison across multiple runs

## License
MIT
