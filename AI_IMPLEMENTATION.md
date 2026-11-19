# AI Implementation (migration-scoper)

Context file for VS Code Copilot. Read together with PRODUCT.md and BUILD_PLAN.md.

## Goal
Add a small, grounded AI layer on top of the deterministic scoping engine. The rules engine stays the source of truth. The model only writes text from evidence the crawl already produced.

## Features in scope
1. **Discovery questions:** tailored customer questions about what the crawl could not see.
2. **Rationale per recommendation:** a short plain-language explanation for each template's rendering strategy.
3. **Executive summary:** a short top-of-report paragraph for non-technical stakeholders.

Out of scope: risk re-ranking, report Q&A chat, proposal drafting.

## Provider: Vercel AI Gateway (free tier)
- Call models through the Vercel AI SDK using a Gateway model string in `provider/model` format.
- Read the model from `process.env.AI_MODEL`. Never hardcode it. Choose one that is marked as free-tier eligible in the Vercel dashboard (AI Gateway -> Models -> Free Tier filter). Start with a small, cheap model.
- Auth: `AI_GATEWAY_API_KEY` locally, or Vercel OIDC when deployed (`vercel env pull` for local dev).
- The free tier gives limited monthly credits and a subset of models. Free-tier terms change, so confirm current terms in Vercel's AI Gateway docs.
- Check the current AI SDK docs for the exact structured-output API for the installed version (`generateObject` vs `generateText` with an object output). Do not guess from memory.

## Architecture
```
CrawlResult --> rules engine --> RuleFindings (typed, evidence-backed)
                                      |
                                      v
                          AI layer (3 independent calls)
                          |-- discoveryQuestions(findings, unknowns)
                          |-- rationales(findings)
                          '-- executiveSummary(findings)
                                      |
                                      v
                                   Report
```
- The AI layer takes only `RuleFindings`, never raw HTML.
- Each call is independent, so one failure does not break the others.

## Suggested files
```
src/lib/ai/
  model.ts          # resolves AI_MODEL, returns model handle, checks key presence
  schemas.ts        # Zod schemas for all three outputs
  prompts.ts        # prompt builders (pure functions, unit-testable)
  discovery.ts      # feature 1
  rationale.ts      # feature 2
  summary.ts        # feature 3
  guardrails.ts     # token caps, rate limit, input trimming
  index.ts          # enrichReport(report) orchestrator
```

## Schemas (Zod)
```ts
// schemas.ts (sketch)
const Evidence = z.object({
  signal: z.string(),           // e.g. "product page: 0 JSON-LD blocks in raw HTML"
  template: z.string().optional(),
});

export const DiscoveryQuestion = z.object({
  question: z.string().max(200),
  why: z.string().max(200),
  category: z.enum(["integrations","checkout","search","catalog","seo","auth","other"]),
  evidence: z.array(Evidence).min(1),
});
export const DiscoveryOutput = z.object({
  questions: z.array(DiscoveryQuestion).min(5).max(10),
});

export const Rationale = z.object({
  template: z.string(),
  strategy: z.enum(["static","ISR","PPR","SSR"]),  // copied from rules, not chosen by model
  explanation: z.string().max(280),
  evidence: z.array(Evidence).min(1),
});
export const RationaleOutput = z.object({ rationales: z.array(Rationale) });

export const ExecutiveSummary = z.object({
  summary: z.string().max(900),
  keyRisks: z.array(z.string().max(160)).max(3),
  confidence: z.enum(["low","medium","high"]),
});
```
Rules:
- The model must **not** change `strategy`. Validate after generation that each rationale's strategy matches the rules engine output, and drop or retry mismatches.
- Every item needs at least one `evidence` entry that maps to a real finding. Validate that referenced signals exist in `RuleFindings`; discard items that do not.

## Prompt rules (all three calls)
- System prompt: you are assisting a Solutions Engineer scoping a migration to Vercel. Use only the provided findings. Do not invent facts, numbers, platforms, or customer details. If evidence is thin, say so.
- Pass findings as compact JSON, not prose.
- Ask for concise output, no marketing language.
- Discovery questions must target gaps: integrations, checkout, search, promotions, auth, data volume. Each must be tied to something observed (for example a third-party call or a missing signal).
- Executive summary: 3-5 sentences, plain language, states overall complexity, top risks, and what is unknown.

## Guardrails (important for a public demo on free credits)
- **Max tokens:** cap output per call (for example 600 for discovery, 800 for rationales, 300 for summary). Trim input to the top N findings.
- **Rate limit:** limit AI-enriched reports per IP per day (default 3). Development uses an in-memory counter; production uses the shared Upstash Redis instance. Beyond the limit, return the report without AI sections.
- **Global daily budget switch:** an env flag `AI_ENABLED=false` disables AI everywhere.
- **Graceful degradation:** if the key or model is missing, the call fails, credits run out, or validation fails, hide the failed AI section and show the deterministic report. Never block the report on AI.
- **Label AI content** in the UI ("AI-generated from crawl evidence").
- **No private data:** only public crawl findings go to the model. No cookies, tokens, or user input beyond the URL.
- **Timeout:** 20-30 seconds per call, run the three calls in parallel.

## Report integration
- `Report` gains optional fields: `ai?: { questions, rationales, summary, model, generatedAt }`.
- UI shows the executive summary at the top, rationale under each template row, and discovery questions in their own section.
- Markdown export includes the AI sections only when present, clearly labelled.

## Environment variables
```
AI_ENABLED=true
AI_MODEL=<gateway model string from the free-tier list>
AI_GATEWAY_API_KEY=<local dev only>
AI_MAX_REPORTS_PER_IP_PER_DAY=3
```
Add all of these to `.env.example` with comments. The Deploy button should work with AI off.

## Tests
- Unit: prompt builders return stable output for fixed findings.
- Unit: schema validation rejects missing evidence, over-length text, and changed strategy.
- Unit: orchestrator returns a report without `ai` when the model call throws.
- Fixture-based: store 2-3 sample `RuleFindings` JSON files and snapshot the prompts.
- Manual: run against 3 demo sites, read the output, and check every claim against the findings.

## Milestones
1. **A1 complete:** `model.ts`, `schemas.ts`, `guardrails.ts`, with a findings fixture.
2. **A2 complete:** `summary.ts`, wired to the report page.
3. **A3 complete:** `rationale.ts` with strategy-match validation.
4. **A4 complete:** `discovery.ts` with evidence validation.
5. **A5 implementation complete:** per-IP daily rate limit, kill switch, graceful degradation, and README section "How AI is used".

After local end-to-end verification, manually run against three authorized demo sites and record the demo video.

## Acceptance criteria
- Report is fully usable with AI disabled.
- No AI statement exists without a matching evidence entry.
- A full run stays within the free-tier credits for normal demo use.
- README states exactly what the AI does and does not do.

## Copilot prompting tips
- Start with: "Read BUILD_PLAN.md, PRODUCT.md and AI_IMPLEMENTATION.md. We are on milestone A1."
- Ask for schemas and tests before implementations.
- Tell it to check current Vercel AI SDK docs for API names before writing calls.