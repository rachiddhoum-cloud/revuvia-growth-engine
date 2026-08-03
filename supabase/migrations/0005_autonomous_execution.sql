-- Revuvia Growth Engine — 0005: autonomous execution (Sprint 4)
-- No new tables: Sprint 4 reuses content_items (blog scheduling),
-- social_posts (LinkedIn/Facebook/X queue), internal_links (auto linking)
-- and reports (plans/scans/score). Only report types are extended.

-- ─────────────────────────────────────────────
-- Reports: extended types (Sprint 4 artifacts)
-- linking_plan      → auto internal linking plan (Phase 2)
-- seo_loop          → weekly SEO optimization tasks (Phase 3)
-- lead_loop         → weekly lead generation plan (Phase 4)
-- opportunities     → opportunity scanner output (Phase 5)
-- execution_calendar→ execution calendar (Phase 6)
-- founder_inbox     → morning top-5 inbox (Phase 7)
-- growth_score      → 0-100 growth score with history (Phase 8)
-- ─────────────────────────────────────────────
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports
  add constraint reports_type_check
  check (type in (
    'weekly', 'monthly', 'audit',
    'action_plan', 'daily_brief', 'ceo',
    'linking_plan', 'seo_loop', 'lead_loop', 'opportunities',
    'execution_calendar', 'founder_inbox', 'growth_score'
  ));
