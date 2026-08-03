# Sprint 7 — Backlink outreach queue

Sprint 7 turns the Ahrefs + GSC data into an autonomous link-building queue:
pages with search traffic but **zero internal links and zero backlinks**
become ICE-ranked outreach tasks with ready-to-send email drafts, persisted
in a new table, injected into the weekly execution calendar and reported as
`outreach_plan`.

## 1. Pure engine — `src/lib/ops/outreach.ts`

- `zeroAuthorityPages()` (linking-intel) is reused to select targets:
  traffic > 0, `incomingLinks === 0`, no Ahrefs backlink.
- Per target: ICE (impact from clicks × confidence × ease), anchor from the
  page title (URL fallback via `titleFromUrl`), expected weekly traffic
  (`impressions × 2%`), reasoning and an outreach email draft.
- Personalization: the best-matching prospect (most shared keyword tokens
  between the prospect's company and the page title) is attached and
  referenced in the draft.
- Deterministic: sorted by ICE desc, then clicks desc, then URL.

## 2. Storage — migration `0008_outreach.sql`

- `outreach_tasks`: one row per `(owner_id, page_url)`, with page metrics,
  ICE, priority, anchor, email draft, reasoning, status
  (`queued / in_progress / done / dropped`) and due date. RLS owner-scoped.
- Report type `outreach_plan` added to the `reports` constraint.

## 3. Orchestration — `src/lib/ops/execute.ts`

- `runOutreachQueue(ownerId)` (server-only):
  1. loads GSC pages (28-day aggregation), internal link counts
     (owner's content only), Ahrefs backlink counts, prospects and the
     connected site domain;
  2. builds the queue (`limit 10`);
  3. upserts `outreach_tasks`, **preserving** each task's status across
     runs (a task already `done` stays `done`);
  4. persists the `outreach_plan` report (markdown + data).
- `executeWeeklyLoop` (Monday) now runs the queue and passes it into the
  execution calendar, so link-building appears as a `link_building` source
  (1 task per day across the week).

## 4. Scheduling

- `/api/ops/outreach` route (gated by `x-cron-secret`), cron **Friday 10:00**
  — after the daily GSC sync (09:00) and the weekly Ahrefs sync (Tue 09:30).
- The Monday weekly loop refreshes the queue and the calendar together.

## 5. Validation

- New tests: outreach engine (10), calendar link_building integration (2) —
  suite at **347/347** (40 files).
- tsc 0, lint 0, build OK.

## 6. Deployment

1. Run migration `0008_outreach.sql`.
2. Optional: seed `prospects` (company, industry, contact_name) to get
   personalized drafts.
3. The Friday cron and Monday loop run autonomously; track execution in
   `outreach_tasks.status` or the `outreach_plan` report.

## 7. Next steps

- Deliver the outreach email (SMTP/Resend channel in the publishing cron).
- Follow-up automation: auto-mark `done` when a backlink appears in the next
  Ahrefs sync.
- Outreach score: report which pages gained their first backlink after a
  campaign.
