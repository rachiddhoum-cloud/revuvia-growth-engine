-- Revuvia Growth Engine — 0008: Backlink outreach queue
-- Sprint 7: pages with traffic but zero internal links and zero backlinks
-- become link-building outreach tasks (ICE-ranked, with email drafts).
-- Owner-scoped, RLS-protected.

-- ---------------------------------------------------------------------------
-- Outreach tasks
-- ---------------------------------------------------------------------------
create table if not exists public.outreach_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  page_url text not null,
  page_title text not null default '',
  clicks int not null default 0,
  impressions int not null default 0,
  anchor text not null default '',
  ice numeric not null default 0,
  priority text not null default 'P2'
    check (priority in ('P0', 'P1', 'P2')),
  expected_traffic int not null default 0,
  email_draft text not null default '',
  reasoning text not null default '',
  status text not null default 'queued'
    check (status in ('queued', 'in_progress', 'done', 'dropped')),
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, page_url)
);

create index if not exists outreach_owner_status_idx
  on public.outreach_tasks (owner_id, status, ice desc);
create index if not exists outreach_owner_ice_idx
  on public.outreach_tasks (owner_id, ice desc);

alter table public.outreach_tasks enable row level security;

create policy "own outreach tasks" on public.outreach_tasks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Reports: extended type
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports
  add constraint reports_type_check
  check (type in (
    'weekly', 'monthly', 'audit',
    'action_plan', 'daily_brief', 'ceo',
    'linking_plan', 'seo_loop', 'lead_loop', 'opportunities',
    'execution_calendar', 'founder_inbox', 'growth_score',
    'seo_health', 'gsc_recommendations', 'outreach_plan'
  ));

create trigger outreach_tasks_touch before update on public.outreach_tasks
  for each row execute function public.set_updated_at();
