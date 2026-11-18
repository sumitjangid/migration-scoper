# Migration Copilot: One-Pager

## What it is
A pre-sales scoping tool for moving a legacy storefront to Vercel. Paste a storefront URL, get a scoping report a Partner Solutions Engineer can bring to a discovery call.

It scopes migrations. It does not perform them.

## The problem
Scoping a legacy-to-Vercel migration (Magento, Hybris, Shopify theme) is slow and manual. Partners often run multi-day paid assessments just to answer basic questions: what rendering strategy fits each page type, where are the SEO risks, roughly how big is the effort, what do we need to ask the customer.

## The solution
Crawl a handful of key templates, analyse them with an LLM using structured output, and produce one report in about an hour of effort instead of days.

## Inputs
- Storefront URL (required)
- Platform hint: Magento / Hybris / Shopify / auto-detect (optional)
- Monthly traffic and catalog size (optional, improves cost estimate)

## Output: one report
1. **Template inventory:** home, category, product, search, cart, content pages, with detected platform.
2. **Rendering recommendation per template:** static, ISR, PPR or SSR, with a one-line rationale each.
3. **Risk register:** redirect volume, canonicals, structured data, third-party script weight, checkout boundary, content invisible to non-JS crawlers (including AI crawlers).
4. **Effort and cost ranges:** t-shirt sizes with stated assumptions, plus a rough Vercel usage estimate.
5. **Discovery questions:** what a front-end crawl cannot see (ERP/OMS, custom checkout, search, promotions, auth), phrased for the customer call.
6. **Phased outline:** three phases, high level only.

## Principles
- Ranges and assumptions, never false precision.
- Every claim traces to something observed in the crawl, or is labelled as an assumption.
- Say what the crawl cannot see.

## Out of scope
Code generation, automated migration, detailed cutover planning, backend/integration analysis.

## Who it is for
Partner Solutions Engineers and Solution Architects doing pre-sales scoping. Secondary: engineers evaluating a move to Vercel.

## Why it exists
Built from hands-on Magento, Hybris and Shopify migration experience. The goal is a credible, open-source example of Next.js, the Vercel AI SDK and Playwright working together on a real problem.

## Success criteria
- Works on 3-5 public storefronts (Magento first, then Shopify; Hybris if a public example is found).
- Report is readable in under 10 minutes.
- Deployed on Vercel with a Deploy button, architecture write-up and short demo video.

## Positioning
"An hour of output instead of a ten-day assessment."
