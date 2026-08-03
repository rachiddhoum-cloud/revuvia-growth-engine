-- Revuvia Growth Engine — 0003: autonomous editorial pipeline
-- Sprint 2: pipeline stages, quality scoring, internal linking, reports, background jobs.
-- Every stage is persisted, every scheduled task is idempotent (unique keys).

-- ─────────────────────────────────────────────
-- Editorial pipeline runs (per content item, per stage)
-- ─────────────────────────────────────────────
create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  stage text not null, -- idea | keyword_research | seo_brief | writing | quality | approval | publish | published | performance
  status text not null default 'pending'
    check (status in ('pending', 'running', 'passed', 'failed', 'skipped')),
  attempt int not null default 0,
  error text,
  payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (content_item_id, stage)
);

create index if not exists pipeline_runs_item_idx on public.pipeline_runs (content_item_id, created_at desc);

alter table public.pipeline_runs enable row level security;

create policy "own pipeline runs" on public.pipeline_runs
  for all using (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- SEO briefs (stage output: seo_brief)
-- ─────────────────────────────────────────────
create table if not exists public.seo_briefs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  primary_keyword text not null,
  secondary_keywords text[] not null default '{}',
  search_intent text, -- informational | commercial | transactional | navigational
  audience text,
  competitors text[] not null default '{}',
  outline text[] not null default '{}',
  word_count_target int not null default 1200,
  created_at timestamptz not null default now(),
  unique (content_item_id)
);

alter table public.seo_briefs enable row level security;

create policy "own briefs" on public.seo_briefs
  for all using (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Content quality scores (stage output: quality)
-- ─────────────────────────────────────────────
create table if not exists public.content_quality_scores (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  overall numeric not null, -- 0-100
  seo_quality numeric not null,
  readability numeric not null,
  originality numeric not null,
  cta_quality numeric not null,
  keyword_density numeric not null,
  title_quality numeric not null,
  meta_quality numeric not null,
  structure numeric not null,
  ai_confidence numeric not null,
  breakdown jsonb not null default '{}'::jsonb,
  passed boolean not null default false, -- overall >= 80
  model text,
  created_at timestamptz not null default now(),
  unique (content_item_id)
);

create index if not exists quality_scores_overall_idx on public.content_quality_scores (overall desc);

alter table public.content_quality_scores enable row level security;

create policy "own quality scores" on public.content_quality_scores
  for all using (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Internal links (stage output: publishing/pre-publish enrichment)
-- ─────────────────────────────────────────────
create table if not exists public.internal_links (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  target_type text not null
    check (target_type in ('article', 'page', 'pricing', 'blog', 'landing')),
  target_url text not null,
  anchor_text text not null,
  context_sentence text,
  source_ai boolean not null default true,
  status text not null default 'active' check (status in ('active', 'broken', 'removed')),
  created_at timestamptz not null default now(),
  unique (content_item_id, target_url)
);

create index if not exists internal_links_item_idx on public.internal_links (content_item_id);

alter table public.internal_links enable row level security;

create policy "own internal links" on public.internal_links
  for all using (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Reports (weekly / monthly / audit)
-- ─────────────────────────────────────────────
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('weekly', 'monthly', 'audit')),
  period_start date not null,
  period_end date not null,
  markdown text not null default '',
  html text not null default '',
  email_html text not null default '',
  pdf_ready text not null default '',
  data jsonb not null default '{}'::jsonb,
  status text not null default 'generated' check (status in ('generated', 'sent', 'failed')),
  generated_at timestamptz not null default now(),
  unique (owner_id, type, period_start)
);

create index if not exists reports_period_idx on public.reports (owner_id, generated_at desc);

alter table public.reports enable row level security;

create policy "own reports" on public.reports
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Background jobs + runs (retry-safe)
-- ─────────────────────────────────────────────
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null, -- daily_seo_scan | weekly_report | monthly_audit
  schedule text not null default '0 8 * * *',
  enabled boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

alter table public.jobs enable row level security;

create policy "own jobs" on public.jobs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'retrying')),
  attempt int not null default 0,
  max_attempts int not null default 3,
  result jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists job_runs_job_idx on public.job_runs (job_id, created_at desc);

alter table public.job_runs enable row level security;

create policy "own job runs" on public.job_runs
  for all using (
    exists (select 1 from public.jobs j where j.id = job_id and j.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.jobs j where j.id = job_id and j.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Content items: add quality_score + pipeline origin fields
-- ─────────────────────────────────────────────
alter table public.content_items
  add column if not exists quality_score numeric, -- latest overall quality score
  add column if not exists brief_id uuid references public.seo_briefs (id) on delete set null;

create index if not exists content_quality_idx on public.content_items (quality_score desc);

-- ─────────────────────────────────────────────
-- Content items: extended status check (pipeline lifecycle)
-- ─────────────────────────────────────────────
alter table public.content_items drop constraint if exists content_items_status_check;
alter table public.content_items
  add constraint content_items_status_check
  check (status in ('idea', 'keyword_research', 'seo_brief', 'draft', 'writing', 'quality', 'ready', 'approved', 'queued', 'published'));

-- ─────────────────────────────────────────────
-- Social posts: allow whatsapp platform
-- ─────────────────────────────────────────────
alter table public.social_posts drop constraint if exists social_posts_platform_check;
alter table public.social_posts
  add constraint social_posts_platform_check
  check (platform in ('linkedin', 'facebook', 'instagram', 'x', 'email', 'video', 'whatsapp'));
