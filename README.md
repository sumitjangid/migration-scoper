# Migration Copilot

Pre-sales scoping for moving a legacy storefront (Magento, Hybris, Shopify theme) to Vercel.

Paste a storefront URL to get a scoping report: rendering strategy per template, SEO and redirect risks, effort and cost ranges, discovery questions, and a phased outline.

> Status: personal project in development. Deterministic heuristics remain the source of truth. Optional AI-generated discovery questions, rendering rationales, and executive summaries are available when configured.

## Responsible use

Only scan websites you own or have explicit authorization to assess. A site being publicly accessible—or allowing a crawler in `robots.txt`—does not grant permission to crawl it. Respect the site's terms and applicable laws, and contact the owner if you are unsure.

The crawler limits its page count and request behavior, but crawling can still create load or trigger page-side effects. These safeguards are not a guarantee of harmlessness. Stop if the site behaves unexpectedly.

Reports are approximate planning aids based on limited public-page observations. They may be incomplete or incorrect and are not professional, legal, security, or cost advice, nor a quote or guarantee of results.

The scope endpoint accepts user-supplied URLs and applies destination checks, DNS pinning, request-size limits, and crawl rate limits. These controls reduce risk but are not a guarantee against all abuse.

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

1. **Crawl:** Playwright loads the URL, discovers up to 8 same-origin pages (home, category, product, search, and content), and captures rendered HTML, raw HTML, network requests, headers, and structured data.
2. **Analyse:** deterministic heuristics and Zod schemas turn the captured signals into per-template recommendations, risks, estimates, and discovery questions. When AI is enabled, the model can add evidence-backed discovery questions, rendering explanations, and an executive summary; it cannot change the recommendations.
3. **Report:** a Next.js page renders the result, with a Markdown export.

The raw-versus-rendered HTML comparison is what flags content that non-JavaScript crawlers, including AI crawlers, cannot see.

### How AI is used

AI enrichment is disabled by default. To enable it locally, set `AI_ENABLED=true`, choose `AI_MODEL` in the Vercel AI Gateway `provider/model` format, and set `AI_GATEWAY_API_KEY`. `AI_MAX_REPORTS_PER_IP_PER_DAY` defaults to 3. Development uses an in-memory daily counter; production uses the configured Upstash Redis instance.

The model receives compact, evidence-backed findings from the public crawl, not raw HTML, cookies, or credentials. It writes discovery questions, short rendering explanations, and an executive summary. Evidence references are validated, and rationales must preserve the deterministic rendering strategy. AI does not choose or re-rank recommendations, answer report questions, or draft proposals. Each AI section runs independently with a timeout; if AI is disabled, over quota, unavailable, or returns invalid output, the report falls back to deterministic analysis.

## Stack
- Next.js (App Router)
- Playwright
- Zod
- Next.js

## Getting started

```bash
git clone <repo-url>
cd migration-copilot
npm install
npm run dev
```

For local development, `npm install` downloads the headless Chromium browser used by the app and CLI. If browser installation was skipped, run `npm run install:browser`. The Vercel API function uses its bundled serverless Chromium runtime.

Open http://localhost:3000 and paste a storefront URL.
Generated reports are saved in the browser's local storage so report pages work across serverless instances and browser restarts. Report links are only available in the same browser and origin; clearing browser storage removes them.

### Production rate limiting

Production requires an Upstash Redis REST database. Configure these server-side environment variables in the hosting platform:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
SCOPE_RATE_LIMIT_PER_IP=3
SCOPE_RATE_LIMIT_GLOBAL=24
```

The scope endpoint allows up to 3 crawls per source IP and 24 crawls total per hour by default. Set `SCOPE_RATE_LIMIT_PER_IP` and `SCOPE_RATE_LIMIT_GLOBAL` to positive integers to adjust those hourly limits for demos or testing; they apply in both local development and production. Invalid values fail closed. Local development uses an in-memory limiter, while production requires the shared limiter to be configured and available.

## Crawl milestone

Run a public storefront crawl from the CLI:

```bash
npm run crawl -- https://example.com
```

The command checks `robots.txt`, discovers representative templates, captures raw and rendered HTML, and prints a validated `CrawlResult` JSON document. It stops if the policy cannot be verified.

## Analysis milestone

Pipe a crawl result directly into the analysis command:

```bash
npm run crawl -- https://example.com | npm run analyse
```

Optional traffic and catalog inputs improve the estimate:

```bash
npm run crawl -- https://example.com | npm run analyse -- --traffic 500000 --catalog 10000
```

The command prints a validated `Report` JSON document. It does not write crawl or report data to disk.

## Limits
- It only sees the public front end. ERP, OMS, custom checkout, search and promotion logic are surfaced as discovery questions, not guessed.
- Estimates are ranges built on stated assumptions, not quotes.
- Only scan sites you own or are explicitly authorized to assess; public accessibility is not permission.
- The crawler checks robots.txt before navigation, applies its rules to first-party requests, and stops if the policy cannot be verified. Missing robots.txt (404/410) is treated as no published restrictions.
- It captures at most 8 same-origin pages, waits at least one second between page captures, and honors crawl-delay up to 30 seconds; larger delays stop the crawl.
- Cart/checkout pages, third-party resources, and non-GET/HEAD requests are excluded. Page scripts still run on allowed first-party pages, so this is not a guarantee of zero side effects.
- The web endpoint only accepts standard HTTP(S) ports on hosts that resolve exclusively to public addresses; browser requests are pinned to a validated address and restricted to the storefront origin. Production rate limits are shared through Upstash and fail closed when unavailable. These safeguards cannot guarantee zero risk or load.

## Roadmap
- Magento support first, then Shopify, then Hybris
- Exportable PDF report
- Comparison across multiple runs

## License
MIT
