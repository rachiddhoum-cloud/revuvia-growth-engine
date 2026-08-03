# Sprint 2 — Business Deliverables

## 1. ICE prioritisation sheet (Impact / Confidence / Ease)

The autonomous pipeline makes content velocity possible. These are the ranked
next bets for Revuvia, scored 1-10 on Impact (revenue/moats), Confidence (how
sure we are it works), and Ease (engineering effort, 10 = trivial).

| # | Opportunity | Impact | Confidence | Ease | ICE | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Auto-publish pipeline on a schedule (cron already wired) | 9 | 8 | 8 | 576 | Content is the compounding engine; schedule removes the only manual step |
| 2 | GSC/Ahrefs data hookup → live dashboard + weekly report numbers | 9 | 9 | 7 | 567 | Without real metrics the loop can't close; highest confidence |
| 3 | Human approval UX in the app (approve/reject UI instead of API only) | 7 | 8 | 7 | 392 | Removes friction for the founder to keep the gate closed |
| 4 | Multi-brand / multi-owner jobs + per-owner reports | 8 | 7 | 5 | 280 | Scales the engine across customers once Revuvia ships multi-tenant |
| 5 | AI agent to reply to reviews (tone-safe drafts) | 8 | 6 | 5 | 240 | Adjacent to pipeline; needs guardrails, lower confidence |
| 6 | Lead-magnet gating on published articles | 6 | 7 | 6 | 252 | Monitises traffic early; simple but downstream of traffic volume |

ICE = Impact × Confidence × Ease. All items assume the Sprint 2 code is already
in production (true).

## 2. CEO recruitment brief (hiring a founder-operator)

The pipeline runs; the bottleneck is now time-to-ship and channel iteration.

### Role: Founding CEO (Revenue & Growth) — Revuvia

**Mission:** Turn a working autonomous content engine into a revenue loop with
10 paying local-business customers within 90 days.

**Why this is a founder role, not a manager role:**
- The product already ships weekly content autonomously (Sprint 2 live).
- Next unlock is **distribution**: GSC hookup, conversion on lead magnets,
  outbound to cafés/restaurants/salons, and pricing validation.
- The CEO owns the revenue metric end-to-end; no hand-offs.

**Must have (60-day outcomes):**
1. Wire GSC/Ahrefs → real dashboard numbers, replacing demo data.
2. 10 signed customers at €/mo, using the published-content flywheel.
3. Pick one acquisition channel and run it (outbound, local SEO, or content SEO).

**Scorecard (30/60/90):**
- 30d: 3 customers, funnel instrumented, weekly report showing real KPIs.
- 60d: 10 customers, CAC < 1 month of MRR, 2 content pieces/week published.
- 90d: path to 50 customers + first hire (part-time writer/VA).

**Offer:** Equity-heavy package, 12-month vest, 1-year cliff. Reports to the
investor (brief owner).

**Red flags we screen for:** prefers agency work over operating; can't show
prior CAC/LTV math; no first-principles content-SEO opinions.

## 3. Success metrics for the sprint itself
| Metric | Target | Status |
| --- | --- | --- |
| Pipeline runs a keyword to published autonomously | Yes, gated | Done |
| Quality gate blocks < 80 scores | Yes | Done |
| Weekly report renders + persists | Yes | Done |
| Cron routes protected by CRON_SECRET | Yes | Done |
| Dashboard shows live KPIs from DB | Yes | Done (needs data source) |
| Tests / typecheck / lint / build | All green | 121 tests, 0 errors |
