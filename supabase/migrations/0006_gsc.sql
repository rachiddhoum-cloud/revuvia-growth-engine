-- Revuvia Growth Engine — 0006: Google Search Console integration
-- Sprint 5: OAuth credentials, normalized GSC storage (sites, queries,
-- pages, daily metrics, sync logs) and the SEO health report type.
-- Every table: owner-scoped, indexed, RLS-protected.

-- ─────────────────────────────────────────────
-- GSC credentials (server-only, never exposed to clients)
-- ─────────────────────────────────────────────
create table if not exists public.search_console_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  site_url text not null,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, site_url)
);

alter table public.search_console_credentials enable row level security;

create policy "own gsc credentials" on public.search_console_credentials
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Connected sites
-- ─────────────────────────────────────────────
create table if not exists public.search_console_sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  site_url text not null,
  name text,
  created_at timestamptz not null default now(),
  unique (owner_id, site_url)
);

create index if not exists gsc_sites_owner_idx on public.search_console_sites (owner_id);

alter table public.search_console_sites enable row level security;

create policy "own gsc sites" on public.search_console_sites
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Queries (daily, per query + search type)
-- ─────────────────────────────────────────────
create table if not exists public.search_console_queries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  site_url text not null,
  query text not null,
  search_type text not null default 'web',
  date date not null,
  clicks int not null default 0,
  impressions int not null default 0,
  ctr numeric not null default 0,
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, site_url, query, search_type, date)
);

create index if not exists gsc_queries_date_idx on public.search_console_queries (owner_id, date desc);
create index if not exists gsc_queries_impressions_idx on public.search_console_queries (owner_id, impressions desc);

alter table public.search_console_queries enable row level security;

create policy "own gsc queries" on public.search_console_queries
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Pages (daily, per page + search type)
-- ─────────────────────────────────────────────
create table if not exists public.search_console_pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  site_url text not null,
  url text not null,
  search_type text not null default 'web',
  date date not null,
  clicks int not null default 0,
  impressions int not null default 0,
  ctr numeric not null default 0,
  position numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, site_url, url, search_type, date)
);

create index if not exists gsc_pages_date_idx on public.search_console_pages (owner_id, date desc);
create index if not exists gsc_pages_clicks_idx on public.search_console_pages (owner_id, clicks desc);

alter table public.search_console_pages enable row level security;

create policy "own gsc pages" on public.search_console_pages
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Daily metrics (site totals, all search types)
-- ─────────────────────────────────────────────
create table if not exists public.search_console_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  site_url text not null,
  date date not null,
  search_type text not null default 'web',
  clicks int not null default 0,
  impressions int not null default 0,
  ctr numeric not null default 0,
  position numeric not null default 0,
  pages int not null default 0,
  queries int not null default 0,
  created_at timestamptz not null default now(),
  unique (owner_id, site_url, date, search_type)
);

create index if not exists gsc_daily_date_idx on public.search_console_daily_metrics (owner_id, date desc);

alter table public.search_console_daily_metrics enable row level security;

create policy "own gsc daily" on public.search_console_daily_metrics
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Sync logs (audit + incremental window planning)
-- ─────────────────────────────────────────────
create table if not exists public.search_console_sync_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  site_url text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  rows_upserted int not null default 0,
  error text,
  sync_window text
);

create index if not exists gsc_logs_owner_idx on public.search_console_sync_logs (owner_id, started_at desc);

alter table public.search_console_sync_logs enable row level security;

create policy "own gsc logs" on public.search_console_sync_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Reports: extended types (SEO health score, CEO recommendations)
-- ─────────────────────────────────────────────
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports
  add constraint reports_type_check
  check (type in (
    'weekly', 'monthly', 'audit',
    'action_plan', 'daily_brief', 'ceo',
    'linking_plan', 'seo_loop', 'lead_loop', 'opportunities',
    'execution_calendar', 'founder_inbox', 'growth_score',
    'seo_health', 'gsc_recommendations'
  ));

create trigger search_console_credentials_touch before update on public.search_console_credentials
  for each row execute function public.set_updated_at();
