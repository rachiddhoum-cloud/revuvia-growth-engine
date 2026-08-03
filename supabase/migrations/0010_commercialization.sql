-- Revuvia Growth Engine — 0010: Commercialization OS (Sprint 9)
-- Extends prospects with acquisition intelligence, full sales pipeline stages,
-- pipeline history (pipeline_events), outbound message log (prospect_messages),
-- and new report types (sales queue / analytics / CEO sales / briefing).
-- Legacy statuses ('new','contacted','replied','demo','closed','lost') stay
-- valid so existing modules keep working; new canonical stages are added.

-- ---------------------------------------------------------------------------
-- Prospects: acquisition intelligence + pipeline stages
-- ---------------------------------------------------------------------------
alter table public.prospects
  drop constraint if exists prospects_status_check;
alter table public.prospects
  add constraint prospects_status_check
  check (status in (
    'new', 'contacted', 'replied', 'demo', 'closed', 'lost', -- legacy
    'new_lead', 'waiting', 'interested', 'demo_scheduled',
    'trial_started', 'negotiation', 'won', 'archived'
  ));

alter table public.prospects add column if not exists website text;
alter table public.prospects add column if not exists google_maps_url text;
alter table public.prospects add column if not exists facebook_url text;
alter table public.prospects add column if not exists instagram_url text;
alter table public.prospects add column if not exists linkedin_url text;
alter table public.prospects add column if not exists phone text;
alter table public.prospects add column if not exists country text;
alter table public.prospects add column if not exists city text;
alter table public.prospects add column if not exists language text;
alter table public.prospects add column if not exists company_size int;
alter table public.prospects add column if not exists est_monthly_reviews int;
alter table public.prospects add column if not exists est_seo_score numeric;
alter table public.prospects add column if not exists est_traffic int;
alter table public.prospects add column if not exists est_opportunity_score numeric;
alter table public.prospects add column if not exists lead_score numeric default 0;
alter table public.prospects
  add column if not exists lead_temperature text
  check (lead_temperature in ('hot', 'warm', 'cold'));
alter table public.prospects add column if not exists acv_usd numeric default 0;

create index if not exists prospects_lead_score_idx
  on public.prospects (owner_id, lead_score desc);
create index if not exists prospects_stage_idx
  on public.prospects (owner_id, status);

-- ---------------------------------------------------------------------------
-- Pipeline history
-- ---------------------------------------------------------------------------
create table if not exists public.pipeline_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  stage text not null
    check (stage in (
      'new', 'contacted', 'replied', 'demo', 'closed', 'lost',
      'new_lead', 'waiting', 'interested', 'demo_scheduled',
      'trial_started', 'negotiation', 'won', 'archived'
    )),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists pipeline_events_prospect_idx
  on public.pipeline_events (owner_id, prospect_id, created_at desc);

alter table public.pipeline_events enable row level security;

create policy "own pipeline events" on public.pipeline_events
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Outbound message log (email / linkedin / whatsapp / facebook / call)
-- ---------------------------------------------------------------------------
create table if not exists public.prospect_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  prospect_id uuid not null references public.prospects (id) on delete cascade,
  channel text not null
    check (channel in ('email', 'linkedin', 'whatsapp', 'facebook', 'call')),
  template_key text,
  subject text,
  body text not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'failed', 'replied')),
  sent_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists prospect_messages_prospect_idx
  on public.prospect_messages (owner_id, prospect_id, sent_at desc);

alter table public.prospect_messages enable row level security;

create policy "own prospect messages" on public.prospect_messages
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Reports: extended types (commercialization)
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
    'learning_insights',
    'sales_pipeline', 'sales_queue', 'sales_analytics', 'ceo_sales',
    'sales_briefing'
  ));

-- ---------------------------------------------------------------------------
-- Knowledge base: sales strategy types (Sprint 9 Phase 8)
-- ---------------------------------------------------------------------------
alter table public.knowledge_base
  drop constraint if exists knowledge_base_strategy_type_check;
alter table public.knowledge_base
  add constraint knowledge_base_strategy_type_check
  check (strategy_type in (
    'article_structure', 'keyword_cluster', 'publication_time', 'cta',
    'lead_magnet', 'channel', 'outreach_pattern', 'backlink_source',
    'content_type',
    'sales_message', 'sales_industry', 'sales_channel', 'sales_cadence'
  ));
