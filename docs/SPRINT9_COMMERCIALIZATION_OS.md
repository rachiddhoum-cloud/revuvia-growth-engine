# Sprint 9 — Commercialization OS

Revuvia Growth Engine now runs the full acquisition funnel on autopilot:
prospect intelligence → lead scoring → personalized outbound kits → CRM
pipeline → daily sales queue (top 20/day) → follow-up engine with channel
escalation → sales analytics + forecast → sales learning (knowledge base) →
CEO one-page report → 2-minute founder briefing. Everything extends the
existing modules (Sprint 3 sales plan, Sprint 4 execution, Sprint 8
learning) — nothing was rewritten or duplicated.

## Architecture

```
prospects (extended)  customers  prospect_messages  pipeline_events
      │                   │             │                 │
      ▼                   ▼             ▼                 ▼
                  loadSalesData (src/lib/sales/server.ts)
      │                   │
      ├───────────────────┴─────────────────────────────┐
      │ weekday 07:45 (cron /api/sales/daily)           │ Monday 09:00 (cron /api/sales/analytics)
      ▼                                                  ▼
 runSalesDaily                                   runSalesAnalytics
 ┌──────────────────────┐                       ┌──────────────────────────────┐
 │ scoring.ts  (P2)     │                       │ analytics.ts     (P7)        │
 │ queue.ts     (P5)    │                       │ ceo.ts           (P9)        │
 │ followup.ts  (P6)    │                       │ learning.ts      (P8)        │
 │ briefing (P10)       │                       │ → knowledge_base upserts     │
 └──────────┬───────────┘                       └──────────────┬───────────────┘
            ▼                                                  ▼
 reports: sales_queue, sales_briefing          reports: sales_analytics, ceo_sales
```

## Phase 1 — Prospect intelligence database

- Migration `0010_commercialization.sql` extends `prospects` with
  `website`, `google_maps_url`, `facebook_url`, `instagram_url`,
  `linkedin_url`, `phone`, `country`, `city`, `language`, `company_size`,
  `est_monthly_reviews`, `est_seo_score`, `est_traffic`,
  `est_opportunity_score`, `lead_score`, `lead_temperature`
  (`hot|warm|cold`) and `acv_usd`.
- Pipeline stages extended to the full 8-step funnel (`new_lead`,
  `contacted`, `waiting`, `interested`, `demo_scheduled`,
  `trial_started`, `negotiation`, `won`, `lost`, `archived`) — the legacy
  statuses (`new`, `contacted`, `replied`, `demo`, `closed`, `lost`) stay
  valid so the Sprint 3 sales module and existing data keep working.
- New `pipeline_events` (stage history, owner-scoped RLS) and
  `prospect_messages` (email / linkedin / whatsapp / facebook / call log
  with `draft|sent|failed|replied`).
- Reports: `sales_pipeline`, `sales_queue`, `sales_analytics`,
  `ceo_sales`, `sales_briefing`. Knowledge base: `sales_message`,
  `sales_industry`, `sales_channel`, `sales_cadence`.

## Phase 2 — Lead scoring (`scoring.ts`)

Every prospect gets a 0-100 opportunity score and a `hot/warm/cold`
temperature from five deterministic factors:

- **Reviews weakness** — few Google reviews = the core Revuvia problem.
- **SEO weakness** — low SEO score / traffic = room to win local search.
- **Revenue potential** — traffic × 1% conversion × ACV (annual).
- **Digital presence** — website 30, Google Maps 15, Facebook 20,
  Instagram 20, LinkedIn 15.
- **Urgency** — visible damage (weak reviews + traffic) makes the fix
  timely; **competition** from traffic size and company size.

`total = reviews×0.35 + seo×0.25 + urgency×0.2 + revenue×0.1 + presence×0.1`;
`ice = total × win probability × 10`. Win probability reuses the existing
`expectedProbability` from `src/lib/ops/sales.ts` (floored at 3% for fresh
leads). `priorityQueue` ranks all open prospects.

## Phase 3 — Personalized outreach generator (`outreach.ts`)

- `detectedProblems`: human-readable problems from the intelligence fields
  ("only ~3 Google reviews…", "invisible on Google for local searches"…).
- `benefitsFor`: industry-specific value props (restaurant / cafe / salon /
  dentist / generic).
- `buildOutreachKit`: first-touch email + 3 follow-ups (LinkedIn d+2,
  WhatsApp d+5, call script d+9) — every message personalized with the
  company name and contact name, zero placeholder tokens.

## Phase 4 — Sales pipeline (`pipeline.ts`)

- Explicit transition map for all 14 statuses (canonical + legacy) with
  `canTransition` / `transitionStage` validation and an 8-stage happy path.
- Per-stage win probabilities (new_lead 0.05 … negotiation 0.6, won 1).
- `buildFunnel`: totals per stage, open deals, open value
  (probability × ACV), win rate, average cycle days from `pipeline_events`.

## Phase 5 — Daily sales queue (`queue.ts`)

`buildDailyQueue` ranks the top 20 actionable prospects each day by
ICE + stage momentum, attaches the personalized first-touch message, the
expected revenue (probability × ACV) and the follow-up date, and totals
the daily effort (2 min per touch). Terminal stages (won/lost/archived/
closed) never appear.

## Phase 6 — Follow-up engine (`followup.ts`)

Decides today's actions per prospect from the message log:

- never touched → `first_contact` (email);
- cadence elapsed → `follow_up` on the next channel (LinkedIn → WhatsApp → call);
- no response after 4+ touches → `escalate` to phone;
- replied / max touches (5) / terminal → `stop`.

## Phase 7 — Sales analytics (`analytics.ts`)

Funnel health, contacted / replies / meetings / trials, paid customers,
MRR + ARR, reply rate (distinct replies / messages sent), win rate, cycle
time, and a deterministic 30/90-day forecast from stage probabilities.

## Phase 8 — Sales learning (`learning.ts`)

`detectSalesPatterns` measures reply-rate uplift per template and channel,
win-rate uplift per industry, and win uplift per touch count — against the
global baseline (≥ +15% = success, ≤ -15% = failure, shared `outcomeFromUplift`
model). Monday's `runSalesAnalytics` upserts observations into the shared
`knowledge_base` through `applyObservation` (confidence +8% of gap on
success, ×0.75 on failure), so sales learnings feed the same recommendation
system as SEO learnings.

## Phase 9 — CEO sales report (`ceo.ts`)

One-page report: top 5 open deals by expected value, prospects lost in the
last 30 days, biggest risks (follow-ups overdue 7+ days, replied prospects
silent 14+ days), highest-value deal and concrete next actions. Persisted
as `ceo_sales`.

## Phase 10 — Founder briefing (≤ 2 min)

`runSalesDaily` (weekdays 07:45) persists `sales_queue` + `sales_briefing`:
today's top-3 prospects to contact, follow-ups due, urgent escalations —
read in 2 minutes.

## Security

- All new tables (`pipeline_events`, `prospect_messages`) are RLS-enabled,
  owner-scoped (`auth.uid() = owner_id`), matching every existing table.
- Routes are protected by the shared `withRouteHandler` + `x-cron-secret`
  (same pattern as `/api/learning/cycle`).
- No secrets, no new env vars, no client exposure: everything runs
  server-side under the service role.

## Automation

| Cron (Vercel) | Endpoint | What runs |
| --- | --- | --- |
| Mon–Fri 07:45 | `/api/sales/daily` | Daily queue (top 20) + follow-ups + 2-min briefing |
| Mon 09:00 | `/api/sales/analytics` | Sales analytics + CEO report + knowledge base updates |
| Mon 05:00 | `/api/ops/execute` | Weekly loop (existing) — sales plan still enriched |
| Mon 04:00 | `/api/learning/cycle` | Autonomous learning (existing) |

Both routes accept an optional `ownerId` in the body for multi-tenant
on-demand runs.

## Deployment

`supabase db push` for migration 0010, then `vercel deploy`. No new env
vars, no new packages. Tests: `npx vitest run` (459 tests / 53 files),
`npx tsc --noEmit`, `npx eslint src --max-warnings 0`, `npm run build`.

## Business impact

- **Wins more deals**: every prospect gets scored, messaged with a
  personalized kit, followed up on the right cadence and escalated to the
  phone — no more forgotten leads.
- **Saves founder time**: 2-minute daily briefing replaces hours of CRM
  triage; the daily queue is capped at 20 prospects (≤ 40 min/day).
- **Compounds knowledge**: winning templates / channels / industries /
  cadence steps raise confidence in the knowledge base; losing ones decay.
- **Visibility**: CEO gets expected revenue (30/90 days), win rate, cycle
  time and risks on one page, every Monday.

## ICE priorities

| Action | Impact | Confidence | Ease | ICE |
| --- | --- | --- | --- | --- |
| Daily queue + follow-ups (Phases 5-6) | 10 | 0.9 | 7 | 63 |
| Lead scoring with temperature (Phase 2) | 8 | 0.9 | 9 | 65 |
| Personalized outreach kits (Phase 3) | 9 | 0.7 | 8 | 50 |
| CEO one-page report (Phase 9) | 7 | 0.9 | 9 | 57 |
| Sales learning into knowledge base (Phase 8) | 6 | 0.7 | 8 | 34 |
| Pipeline + analytics + forecast (Phases 4, 7) | 7 | 0.8 | 8 | 45 |

## Audits

### Technical audit

- **Type safety**: `tsc --noEmit` clean (0 errors) — new rows
  (`PipelineEventRow`, `ProspectMessageRow`), extended `ProspectRow` /
  `ProspectStatus` / `ReportType` / `KnowledgeStrategyType`, typed
  `Database.Tables` entries.
- **Lint**: `eslint src --max-warnings 0` clean.
- **Tests**: 459/459 (53 files), including 71 new sales tests
  (scoring 23, outreach 9, pipeline 10, queue 5, follow-up 9, analytics 4,
  learning 7, ceo 4).
- **Build**: production build OK.
- **No duplication**: reuses `expectedProbability` / `followUpDate`
  (ops/sales), `applyObservation` / `newEntry` / `outcomeFromUplift`
  (learning), `todayLocal` (ops/publishing), shared report persistence and
  `withRouteHandler` patterns.
- **Deterministic**: all engines pure; time inputs injected (`now`, `asOf`,
  `date`) so reports are reproducible.

### Business audit

- Full funnel automation: 20 prospects contacted/day (40 min effort),
  cadence d+2/d+5/d+9 with channel escalation, stop rules prevent spam
  and ghosting.
- Founder time: 2-minute briefing vs manual CRM triage; CEO report is
  generated, not written.
- Reuses existing pipeline: no migration of legacy statuses needed
  (legacy values remain valid), no data loss.

### Sales audit

- Reply rate, win rate, cycle time and forecast are computed from actual
  message / event data (no fake numbers).
- Follow-up engine is driven by real sent timestamps — nothing is
  "due" until the cadence has elapsed.
- Every recommendation is actionable ("send the follow-up sequence",
  "push to close", "add 10+ prospects").

### Growth audit

- Sales learnings feed the shared knowledge base, so templates/channels
  that convert get recommended with rising confidence.
- Forecast (30/90 days) makes pipeline health visible before revenue
  dips — lead-gen actions trigger automatically when the forecast drops
  below MRR.

### Revenue audit

- Expected revenue per deal = stage probability × ACV; queue and CEO
  report rank by it.
- MRR / ARR / paid customers computed from `customers` (paid status),
  consistent with Sprint 3.
- Forecast model: Σ probability × ACV/12 per open deal — conservative,
  deterministic, documented.

### CEO decision audit

- One page: top opportunities, risks, recommendations, forecast — the
  CEO decides in 2 minutes what to do this week.
- Risks are concrete (which companies, how many days overdue), not
  generic statements.

### Deployment checklist

1. `supabase db push` (migration `0010_commercialization.sql`).
2. `vercel deploy` — crons `/api/sales/daily` (Mon–Fri 07:45) and
   `/api/sales/analytics` (Mon 09:00) are part of `vercel.json`.
3. Verify: POST `/api/sales/daily` and `/api/sales/analytics` with the
   cron secret return `ok: true`.
4. Smoke test: queue items ≤ 20, follow-ups due today, briefing markdown
   renders, `sales_analytics` report present, `knowledge_base` rows for
   `sales_*` strategy types.
