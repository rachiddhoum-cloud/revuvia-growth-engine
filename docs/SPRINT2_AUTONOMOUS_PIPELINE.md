# Sprint 2 — Autonomous Growth Pipeline (Revuvia Growth Engine)

## Goal
Turn the 6 MVP modules into an autonomous editorial engine: idea → keyword
research → SEO brief → AI writing → 9-dimension quality gate → human approval
→ internal linking → publish → performance, plus social repurposing, a weekly
report, retry-safe background jobs, cron-scheduled API routes, and a live
analytics dashboard.

## Phases delivered

### Phase 1 — Pipeline core (`src/lib/pipeline/`)
- `pipeline.ts` — `runPipeline(keyword, { store, executors, autoApprove, stopAt })` drives an item through 9 persisted stages (`PIPELINE_STAGES`). Idempotent per `(content_item_id, stage)` unique key: rerunning a passed stage is a no-op.
- `memory-store.ts` — in-memory `PipelineStore` mirroring Supabase semantics.
- `pipeline.test.ts` — 10 tests: full run, idempotency, human gate pause at `approval`, `stopAt`, quality gate failure → back to `draft`, executor-throw handling, `approvePipeline` resume.

### Phase 2 — Quality scorer (`src/lib/quality/`)
- `scorer.ts` — deterministic 9-dimension scorer (SEO, readability, originality, CTA, keyword density, title, meta, structure, AI confidence), weights sum to 1.0, `QUALITY_PASS_THRESHOLD = 80`. Optional `aiConfidence` input.
- 19 tests covering pass/fail boundaries, empty body, clickbait, keyword stuffing, CTA quality, vocabulary diversity, JSON-LD/snippet/internal-link rewards.

### Phase 3 — Internal linking (`src/lib/linking/`)
- `engine.ts` — `buildInternalLinkPlan` ranks published articles and produces context-aware link suggestions (target type, anchor, sentence, AI flag, score).
- 13 tests.

### Phase 4 — Social repurposing (`src/lib/social/repurpose.ts`)
- Deterministic platform-native posts (LinkedIn / X / Facebook / Instagram / WhatsApp / Email) with per-platform char limits, hooks, stats, CTA link, hashtags.
- 16 tests.

### Phase 5 — Weekly report (`src/lib/reports/weekly.ts`)
- Pure renderers `toMarkdown`, `toHtml`, `toEmailHtml` from a `WeeklyReportData` bundle; helpers `formatPercent`, `formatMoney`, `formatDuration`, `ctrFrom`.
- 19 tests.

### Phase 6 — Analytics dashboard (`src/lib/analytics/`)
- `aggregate.ts` — pure transforms: `buildSeries` (continuous 30/90-day series, timezone-safe), `summarize` (KPIs, CTR, avg quality, quality buckets, module runs, AI cost), `rankTopPages`, `statusDistribution`, `buildAnalyticsModel`, `displayVisits`.
- `load.ts` — server-only Supabase loader (`daily_metrics`, `page_metrics`, `content_items`, `generation_runs`), degrades to empty on error.
- `src/app/(app)/analytics/page.tsx` — server page wired to `SeoDashboardClient` (Recharts trend, KPI cards, CTR, quality buckets, AI spend, top pages, status distribution).
- 14 tests (timezone-independent via injectable `end` date).

### Phase 7 — Background jobs (`src/lib/jobs/`)
- `runner.ts` — `runJob` with exponential backoff (`baseBackoffMs` × 2ⁿ, capped at `maxBackoffMs`), `isRetryableError` (overloaded / rate-limit / timeout / 429 / 5xx), `maxAttempts` default 3, disabled-job short-circuit. Every run recorded via `JobStore`.
- `memory-store.ts` / `supabase-store.ts` — stores.
- 11 tests.

### Phase 8 — Routes + crons (`src/app/api/`)
| Route | Method | Purpose | Gate |
| --- | --- | --- | --- |
| `/api/pipeline/run` | POST | Run the pipeline for a keyword | rate-limit |
| `/api/pipeline/approve` | POST | Approve a pipeline paused at `approval` | rate-limit |
| `/api/jobs/run` | POST | Execute a registered job via the retry runner | `x-cron-secret` |
| `/api/reports/generate` | POST | Render + persist weekly report (upsert on `owner_id,type,period_start`) | `x-cron-secret` |
| `/api/reports/weekly` | POST | (Sprint 1) cron email via Resend | `x-cron-secret` |

`vercel.json` crons:
- `0 8 * * 1` → `/api/reports/weekly`
- `0 7 * * 1` → `/api/reports/generate`
- `0 6 * * *` → `/api/jobs/run`

### Phase 9 — Integration + docs
- `src/lib/integration/sprint2.test.ts` — end-to-end in-memory proof: pipeline → social posts → weekly report render → retry-safe job → analytics model, plus the quality-gate block path. 3 tests.

## Schema (`supabase/migrations/0003_autonomous_pipeline.sql`)
New tables: `pipeline_runs`, `seo_briefs`, `content_quality_scores`,
`internal_links`, `reports`, `jobs`, `job_runs`. Content items gained
`quality_score` + `brief_id`; status check extended to the 10-step lifecycle;
`social_posts` allows `whatsapp`. All tables have RLS scoped to the content
owner.

## Key design decisions
- **Idempotency everywhere**: pipeline `(content_item_id, stage)`, reports `(owner_id, type, period_start)`, internal links `(content_item_id, target_url)`.
- **Human-in-the-loop**: `autoApprove: false` (default) pauses at `approval`; `/api/pipeline/approve` resumes.
- **Quality gate**: failing stages return to `draft` and stop the pipeline — no low-quality content publishes.
- **Pure cores, injected IO**: pipeline/jobs/analytics are pure with injected stores → fully unit-testable without Supabase or AI.

## Verification
```
npx tsc --noEmit   # 0 errors
npm run lint       # 0 errors, 0 warnings
npm run test:unit  # 121/121 passed (11 files)
npm run build      # success, all routes present
```

## Deploy checklist
1. Push `0003_autonomous_pipeline.sql` to the Supabase project (`npm run db:push`).
2. Ensure `CRON_SECRET` env var matches the value Vercel sends as `x-cron-secret`.
3. Crons require Vercel Hobby plan or above.
4. Seed `jobs` rows (e.g. `weekly_report`, `daily_seo_scan`) for `/api/jobs/run` to pick up.
5. Dashboard reads `daily_metrics`/`page_metrics`; wire a ranking source (e.g. Google Search Console export or Ahrefs) to populate them.
