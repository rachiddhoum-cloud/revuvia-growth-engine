-- Revuvia Growth Engine — initial schema
-- 6 modules: SEO Intelligence, Content Factory, Calendar, Lead Magnets, Dashboard, Library

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- Profiles (founder / team)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  company text default 'Revuvia',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ─────────────────────────────────────────────
-- SEO projects (domain / niche under study)
-- ─────────────────────────────────────────────
create table if not exists public.seo_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  target_url text,
  country text default 'MA',
  language text default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.seo_projects enable row level security;

create policy "own projects" on public.seo_projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Keyword clusters
-- ─────────────────────────────────────────────
create table if not exists public.keyword_clusters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.seo_projects (id) on delete cascade,
  name text not null,
  intent text, -- informational | commercial | transactional | navigational
  created_at timestamptz not null default now()
);

alter table public.keyword_clusters enable row level security;

create policy "own clusters" on public.keyword_clusters
  for all using (
    exists (select 1 from public.seo_projects p where p.id = project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.seo_projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Keywords
-- ─────────────────────────────────────────────
create table if not exists public.keywords (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.seo_projects (id) on delete cascade,
  cluster_id uuid references public.keyword_clusters (id) on delete set null,
  keyword text not null,
  volume int default 0,
  difficulty int default 0, -- 0-100
  intent text, -- informational | commercial | transactional | navigational
  cpc numeric default 0,
  opportunity_score numeric default 0, -- 0-100
  priority int default 0, -- ranking position
  competitors jsonb default '[]'::jsonb,
  serp jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists keywords_project_idx on public.keywords (project_id);
create index if not exists keywords_cluster_idx on public.keywords (cluster_id);
create index if not exists keywords_opportunity_idx on public.keywords (opportunity_score desc);

alter table public.keywords enable row level security;

create policy "own keywords" on public.keywords
  for all using (
    exists (select 1 from public.seo_projects p where p.id = project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.seo_projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Competitors
-- ─────────────────────────────────────────────
create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.seo_projects (id) on delete cascade,
  domain text not null,
  keyword_overlap jsonb default '[]'::jsonb,
  authority_score int default 0,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.competitors enable row level security;

create policy "own competitors" on public.competitors
  for all using (
    exists (select 1 from public.seo_projects p where p.id = project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.seo_projects p where p.id = project_id and p.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Content categories
-- ─────────────────────────────────────────────
create table if not exists public.content_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  slug text not null,
  color text default '#7c6cf5',
  created_at timestamptz not null default now(),
  unique (owner_id, slug)
);

alter table public.content_categories enable row level security;

create policy "own categories" on public.content_categories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Content items (articles, landing pages, FAQs, lead magnets)
-- ─────────────────────────────────────────────
create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.seo_projects (id) on delete set null,
  keyword_id uuid references public.keywords (id) on delete set null,
  category_id uuid references public.content_categories (id) on delete set null,
  cluster_id uuid references public.keyword_clusters (id) on delete set null,
  kind text not null default 'article'
    check (kind in ('article', 'landing', 'faq', 'lead_magnet')),
  lead_magnet_kind text -- checklist | guide | template | ebook | worksheet | pdf
    check (lead_magnet_kind in ('checklist', 'guide', 'template', 'ebook', 'worksheet', 'pdf')),
  title text not null,
  slug text not null,
  status text not null default 'idea'
    check (status in ('idea', 'writing', 'review', 'ready', 'published')),
  body_markdown text default '',
  excerpt text,
  meta_title text,
  meta_description text,
  json_ld jsonb default '{}'::jsonb,
  faqs jsonb default '[]'::jsonb,
  internal_links jsonb default '[]'::jsonb,
  cta jsonb default '{}'::jsonb,
  featured_snippet text,
  cover_url text,
  tags text[] default '{}',
  version int not null default 1,
  scheduled_for timestamptz,
  published_at timestamptz,
  is_lead_magnet boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index if not exists content_owner_idx on public.content_items (owner_id);
create index if not exists content_status_idx on public.content_items (status);
create index if not exists content_kind_idx on public.content_items (kind);
create index if not exists content_published_idx on public.content_items (published_at desc);

alter table public.content_items enable row level security;

create policy "own content" on public.content_items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Content versions (version history)
-- ─────────────────────────────────────────────
create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (content_item_id, version)
);

alter table public.content_versions enable row level security;

create policy "own versions" on public.content_versions
  for all using (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Social posts (transformed from articles)
-- ─────────────────────────────────────────────
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid references public.content_items (id) on delete set null,
  platform text not null check (platform in ('linkedin', 'facebook', 'instagram', 'x', 'email', 'video')),
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  scheduled_for timestamptz,
  published_at timestamptz,
  external_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_owner_idx on public.social_posts (owner_id);
create index if not exists social_item_idx on public.social_posts (content_item_id);

alter table public.social_posts enable row level security;

create policy "own social" on public.social_posts
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Content calendar entries
-- ─────────────────────────────────────────────
create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid references public.content_items (id) on delete cascade,
  title text not null,
  scheduled_at timestamptz not null,
  channel text default 'blog' check (channel in ('blog', 'linkedin', 'facebook', 'instagram', 'x', 'email')),
  status text not null default 'idea'
    check (status in ('idea', 'writing', 'review', 'ready', 'published')),
  sort_order int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_owner_date_idx on public.calendar_entries (owner_id, scheduled_at);

alter table public.calendar_entries enable row level security;

create policy "own calendar" on public.calendar_entries
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Lead magnet downloads
-- ─────────────────────────────────────────────
create table if not exists public.lead_magnet_downloads (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  email text,
  owner_id uuid references public.profiles (id) on delete set null,
  downloaded_at timestamptz not null default now(),
  user_agent text,
  referrer text
);

create index if not exists downloads_item_idx on public.lead_magnet_downloads (content_item_id);

alter table public.lead_magnet_downloads enable row level security;

create policy "owner reads downloads" on public.lead_magnet_downloads
  for select using (
    exists (select 1 from public.content_items c where c.id = content_item_id and c.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────
-- Rank tracking snapshots
-- ─────────────────────────────────────────────
create table if not exists public.rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  keyword_id uuid not null references public.keywords (id) on delete cascade,
  position int, -- null = not ranking
  url text,
  device text default 'desktop',
  tracked_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (keyword_id, device, tracked_on)
);

create index if not exists rank_keyword_idx on public.rank_snapshots (keyword_id, tracked_on);

alter table public.rank_snapshots enable row level security;

create policy "owner reads ranks" on public.rank_snapshots
  for select using (
    exists (
      select 1 from public.keywords k
      join public.seo_projects p on p.id = k.project_id
      where k.id = keyword_id and p.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- Daily performance metrics (traffic, conversions)
-- ─────────────────────────────────────────────
create table if not exists public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  metric_date date not null default current_date,
  organic_visits int default 0,
  clicks int default 0,
  impressions int default 0,
  ctr numeric default 0,
  conversions int default 0,
  lead_downloads int default 0,
  revenue numeric default 0,
  unique (owner_id, metric_date)
);

alter table public.daily_metrics enable row level security;

create policy "own metrics" on public.daily_metrics
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Top pages performance
-- ─────────────────────────────────────────────
create table if not exists public.page_metrics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  url text not null,
  visits int default 0,
  clicks int default 0,
  impressions int default 0,
  ctr numeric default 0,
  avg_position numeric default 0,
  updated_at timestamptz not null default now(),
  unique (owner_id, url)
);

alter table public.page_metrics enable row level security;

create policy "own page metrics" on public.page_metrics
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- AI generation runs (audit / cost tracking)
-- ─────────────────────────────────────────────
create table if not exists public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  module text not null, -- seo | content | social | calendar | leadmagnet
  model text,
  prompt_tokens int default 0,
  completion_tokens int default 0,
  cost_usd numeric default 0,
  status text default 'completed',
  created_at timestamptz not null default now()
);

alter table public.generation_runs enable row level security;

create policy "own runs" on public.generation_runs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- updated_at trigger helper
-- ─────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger content_items_touch before update on public.content_items
  for each row execute function public.set_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger seo_projects_touch before update on public.seo_projects
  for each row execute function public.set_updated_at();
create trigger keywords_touch before update on public.keywords
  for each row execute function public.set_updated_at();
create trigger social_touch before update on public.social_posts
  for each row execute function public.set_updated_at();
create trigger calendar_touch before update on public.calendar_entries
  for each row execute function public.set_updated_at();
