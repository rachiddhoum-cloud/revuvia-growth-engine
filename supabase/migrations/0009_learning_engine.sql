-- Revuvia Growth Engine — 0009: Autonomous learning engine (Sprint 8)
-- Persistent knowledge layer: every completed campaign updates the strategy
-- knowledge base (confidence + outcome metrics), and the Monday cycle emits
-- a learning_insights report (what worked, what to stop, what to repeat).
-- Owner-scoped, RLS-protected.

-- ---------------------------------------------------------------------------
-- Knowledge base
-- ---------------------------------------------------------------------------
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  strategy_type text not null
    check (strategy_type in (
      'article_structure', 'keyword_cluster', 'publication_time', 'cta',
      'lead_magnet', 'channel', 'outreach_pattern', 'backlink_source',
      'content_type'
    )),
  key text not null,
  confidence numeric not null default 0.5
    check (confidence >= 0 and confidence <= 1),
  attempts int not null default 0,
  successes int not null default 0,
  failures int not null default 0,
  metrics jsonb not null default '{}'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  learned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, strategy_type, key)
);

create index if not exists knowledge_owner_idx
  on public.knowledge_base (owner_id, strategy_type);
create index if not exists knowledge_confidence_idx
  on public.knowledge_base (owner_id, confidence desc);

alter table public.knowledge_base enable row level security;

create policy "own knowledge" on public.knowledge_base
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Reports: extended type (learning_insights)
-- ---------------------------------------------------------------------------
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports
  add constraint reports_type_check
  check (type in (
    'weekly', 'monthly', 'audit',
    'action_plan', 'daily_brief', 'ceo',
    'linking_plan', 'seo_loop', 'lead_loop', 'opportunities',
    'execution_calendar', 'founder_inbox', 'growth_score',
    'seo_health', 'gsc_recommendations', 'outreach_plan',
    'learning_insights'
  ));

create trigger knowledge_base_touch before update on public.knowledge_base
  for each row execute function public.set_updated_at();
