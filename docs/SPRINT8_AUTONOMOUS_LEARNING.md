# Sprint 8 — Autonomous learning engine

Revuvia Growth Engine now learns continuously: every Monday it ingests all
historical artifacts, updates a persistent knowledge base (confidence rises
for strategies that worked, decays for failures), detects success patterns
and failures, and every recommendation is backed by historical evidence
with an explicit confidence model.

## Architecture

```
┌─────────────────────┐   every Monday 04:00   ┌──────────────────────┐
│ content_items, GSC  │ ─────────────────────► │ runLearningCycle     │
│ social_posts,       │                        │  (src/lib/learning/  │
│ outreach_tasks,     │                        │   server.ts)         │
│ ahrefs_backlinks,   │                        └──────────┬───────────┘
│ magnets, daily      │                                   │
└─────────────────────┘            ┌──────────────────────▼──────────────┐
                                   │ patterns.ts (P4)  failures.ts (P5)  │
                                   │ memory.ts (P2)     insights.ts (P7)  │
                                   └──────────────────────┬──────────────┘
                                                          │
                              ┌───────────────────────────▼──────────────┐
                              │ knowledge_base (migration 0009)         │
                              │ + report learning_insights              │
                              └──────────────────────────────────────────┘
```

## Phase 1 — Performance memory

- Migration `0009_learning_engine.sql`: `knowledge_base` table, one row per
  `(owner_id, strategy_type, key)` with confidence (0-1), attempts /
  successes / failures, outcome metrics (avg traffic, leads, CTR,
  engagement, revenue), uplift vs baseline and evidence references. RLS
  owner-scoped.
- Strategy types: `article_structure`, `keyword_cluster`,
  `publication_time`, `cta`, `lead_magnet`, `channel`, `outreach_pattern`,
  `backlink_source`, `content_type`.
- Historical performance is read from the existing tables (content, GSC
  pages/queries, social posts, outreach tasks, Ahrefs backlinks, lead
  magnet downloads, daily metrics) — no duplicate storage.

## Phase 2 — Learning engine (`memory.ts`)

- `updateConfidence`: success pulls confidence toward 1 (+8% of the
  remaining gap), failure decays 25%, clamped to [0.05, 0.95].
- `rateOutcome` / `outcomeFromUplift`: ≥ +15% uplift = success, ≤ -15% =
  failure.
- `applyObservation`: merges metrics (attempt-weighted) and grows counters
  per campaign; every pattern detected on Monday updates its knowledge
  entry accordingly.

## Phase 3 — Decision optimizer

Every recommendation now carries "because…" historical evidence:

- `/api/gsc/recommendations`: quick wins are enriched with a
  `confidenceModel` (from the knowledge base) and the report gains a
  "Learning evidence" section; markdown shows
  `74% conf · ~274 visits · +$191 ROI · Title has number (4 samples): +37% traffic…`.
- `executeWeeklyLoop`: each opportunity gets a "Because:" line in the
  opportunities report + evidence map in the report data.

## Phase 4 — Success patterns (`patterns.ts`)

Automatic detection of winners vs baseline (deterministic, min-samples
guarded):

- Article structures (number in title, how-to/guide, title length, kind).
- Keyword clusters (leading query token).
- Publication times (best weekday from revenue, best hour from posts).
- CTAs, lead magnets (by kind), channels (published share), outreach
  (personalized vs generic), backlink sources (avg domain rating).

## Phase 5 — Failure detection (`failures.ts`)

- Low-ROI content: 14+ days published with zero clicks → refresh / hub /
  301.
- Dead keywords: impressions collapsed > 50% with no clicks → stop or
  rework.
- Never-ranking pages: 100+ impressions stuck below position 20 → rewrite
  or consolidate.
- Stale outreach: untouched 14+ days or done without reply 21 days → change
  angle or follow up.
Each failure carries a severity and a corrective action.

## Phase 6 — AI confidence model (`confidence.ts`)

`recommendationConfidence()` exposes, for every recommendation:
**confidence, expected ROI, expected traffic, expected leads, expected
revenue, expected MRR and ICE** — derived from the strongest matching
knowledge entries (fuzzy key/topic matching), with one-line evidence
statements.

## Phase 7 — Weekly self-improvement (`insights.ts`)

Monday report `learning_insights` answers:
- **What did I learn last week?** (patterns with ≥ 15% uplift)
- **What should I stop doing?** (failures + corrective actions)
- **What should I do more?** (double-down list)

## Scheduling

- `/api/learning/cycle` (x-cron-secret) — **Monday 04:00**, before the
  weekly loop (05:00) so the knowledge base feeds that day's opportunities.
- On-demand trigger supported via POST body `{ ownerId }`.

## Validation

- New tests: memory (7), patterns (11), failures (7), confidence (7),
  insights (5), plus 4 suite-level — suite at **388/388 tests (45 files)**.
- tsc 0, lint 0, build OK.

## Deployment

1. Run migration `0009_learning_engine.sql`.
2. The Monday cron populates the knowledge base automatically; GSC +
   Ahrefs data enrich it over time.
3. No UI: this sprint only improves future business decisions (reports,
   recommendations, opportunity evidence).

## Next steps

- Close the loop: delivery of outreach emails (SMTP/Resend) so reply rates
  feed the knowledge base.
- Backlink-won auto-detection: mark outreach `done` + success when Ahrefs
  sees the first backlink.
- Recommendation engine v2: use the confidence model to weight the
  execution calendar and content queue.
