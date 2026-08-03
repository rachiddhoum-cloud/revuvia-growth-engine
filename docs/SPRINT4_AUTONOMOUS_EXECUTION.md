# Sprint 4 — Autonomous Growth Execution

The platform can analyze. Now it **executes**. Sprint 4 turns the Growth
Engine into an autonomous marketing operator: repetitive marketing tasks run
by cron, and the founder only reads a 2-minute inbox every morning and
validates high-impact decisions. No dashboards were added — the CEO Dashboard
gains a single Growth Score card.

## 1. Architecture

```
crons (Vercel)                     pure generators (src/lib/ops)          persistence
─────────────                      ────────────────────────────          ───────────
Mon 05:00  /api/ops/execute ───►  executeWeeklyLoop()
                                  ├─ analyzeInternalLinks        ──► internal_links + reports(linking_plan)
                                  ├─ buildSeoOptimizationPlan    ──► reports(seo_loop)
                                  ├─ buildLeadGenerationPlan     ──► reports(lead_loop)
                                  ├─ buildOpportunities          ──► reports(opportunities)
                                  ├─ buildExecutionCalendar      ──► reports(execution_calendar)
                                  └─ buildGrowthScore            ──► reports(growth_score)   (+ trend)

daily 08:00  /api/ops/publish ──►  runPublishing()
                                  ├─ schedulePublishing          ──► content_items.scheduled_for + social_posts
                                  └─ markPublished               ──► status published + published_at

daily 07:00  /api/ops/inbox   ──►  runFounderInbox()
                                  └─ buildFounderInbox           ──► reports(founder_inbox)   (≤ 2 min)
```

All generators are pure, deterministic, unit-tested, and take injected data
(`GrowthSnapshot` + signals). All persistence is idempotent: report upserts
on `(owner_id, type, period_start)`, internal links on
`(content_item_id, target_url)`, social posts are only inserted when missing.

## 2. The 8 phases

| Phase | Artifact | Generator | Schedule |
| --- | --- | --- | --- |
| 1 — Auto publishing queue | blog + LinkedIn + Facebook + X slots with platform drafts | `publishing.ts` | daily cron executes due slots |
| 2 — Auto internal linking | contextual link suggestions + orphans + coverage % | `linking.ts` | Monday |
| 3 — SEO optimization loop | declining pages, rising competitors, keyword gaps → ICE tasks | `seo-loop.ts` | Monday |
| 4 — Lead generation loop | magnets, landing pages, CTAs, email sequences ranked by ICE | `lead-loop.ts` | Monday |
| 5 — Opportunity scanner | seasonal, trending, local, competitor weaknesses ranked by ROI | `opportunities.ts` | Monday |
| 6 — Execution calendar | daily/weekly/monthly tasks: priority, deadline, ROI, traffic, leads, MRR | `calendar.ts` | Monday |
| 7 — Founder inbox | today's top 5 priorities, ≤ 2 min reading | `inbox.ts` | daily 07:00 |
| 8 — Growth score | 0-100 from 7 dimensions + trend | `growth-score.ts` | Monday (+ history) |

## 3. Automation flow (a typical week)

1. **Sunday night** — sales updates `customers` / `prospects`; content items
   marked `approved` pass the quality gate.
2. **Monday 05:00** — `/api/ops/execute` runs every optimizer: linking plan is
   written into `internal_links`, SEO/lead/opportunity tasks are persisted,
   the execution calendar (with ROI/traffic/leads/MRR per task) is built, and
   the growth score is recomputed with the previous total for the trend.
3. **Daily 07:00** — founder inbox: top 5 priorities with effort estimates
   and urgent issues (churn, traffic drops). Read time is capped at 2 minutes.
4. **Daily 08:00** — `/api/ops/publish`: approved articles get their
   multi-platform queue (blog slot + LinkedIn/Facebook/X drafts with
   staggered dates, capped at 2 blogs/week); slots due today flip to
   `published` with timestamps.
5. **Anytime** — the CEO Dashboard shows the latest snapshot, the weekly plan
   and the growth score card with its evolution over time.

## 4. Business value

- **Zero manual scheduling**: every approved article is automatically placed
  on 4 platforms with platform-specific copy.
- **Internal links without an SEO hire**: orphans are found automatically,
  coverage % is tracked weekly.
- **Every task has a number**: priority, deadline, expected ROI, expected
  traffic, expected leads, expected MRR — the founder never guesses.
- **2 minutes per day**: the inbox replaces an hour of planning.
- **One number to trend**: the growth score (SEO/content/traffic/leads/
  conversion/revenue/execution) moves weekly and lives in `reports` for history.

## 5. Deployment checklist

1. Apply migration: `supabase/migrations/0005_autonomous_execution.sql`
   (extends the `reports.type` check constraint; no new tables).
2. Set `CRON_SECRET` in Vercel env (must match `x-cron-secret`).
3. Deploy; verify crons fire:
   - `POST /api/ops/execute` → 200, rows in `internal_links` + 6 report types.
   - `POST /api/ops/publish` → 200, `social_posts` scheduled rows appear.
   - `POST /api/ops/inbox` → 200, `founder_inbox` row for today.
4. Seed `content_items` with status `approved`/`queued` (quality ≥ 80) to feed
   the publishing queue; seed `prospects`/`customers` industries for the
   opportunity scanner.
5. Open `/dashboard` — the Growth Score card appears once `growth_score`
   exists (after the first Monday execution).

## 6. Expected ROI (90-day execution plan)

| Window | Actions (autonomous) | Expected result |
| --- | --- | --- |
| Days 1-30 | 4 blog posts + 12 social posts, linking plan on every article, top-5 daily inbox | +30% indexed pages, first organic leads |
| Days 31-60 | SEO loop tasks executed (revive declining pages, cover keyword gaps), 2 lead magnets live | 2x lead downloads, first trials |
| Days 61-90 | Opportunities executed (seasonal + local), CTAs replaced by magnet CTAs, score trending up | 10 paid customers, MRR > $1,000 |

Per-task estimates (ROI, traffic, leads, MRR) are computed weekly by the
execution calendar itself, so the roadmap self-reports.

## 7. Guardrails

- **No experimental AI**: everything is deterministic scoring and copy
  templates; no model calls in the loop.
- **No feature creep**: zero new pages; one card on the existing dashboard.
- **Idempotent everywhere**: re-running any cron is safe.
- **Quality gate intact**: only `approved`/`queued` items (gate ≥ 80) enter
  the publishing queue.
