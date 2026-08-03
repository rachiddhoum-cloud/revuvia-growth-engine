-- ─────────────────────────────────────────────
-- Sprint 6 — Social platform credentials
-- Stores per-platform OAuth tokens (LinkedIn, Facebook, X) so the
-- publishing cron can POST real content instead of only marking
-- social_posts as published. RLS owner-scoped.
-- ─────────────────────────────────────────────

create table if not exists public.social_credentials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('linkedin', 'facebook', 'x')),
  access_token text not null,
  refresh_token text,
  account_id text,
  account_name text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, platform)
);

create index if not exists social_creds_owner_idx on public.social_credentials (owner_id);

alter table public.social_credentials enable row level security;

create policy "own social credentials" on public.social_credentials
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create trigger social_creds_touch before update on public.social_credentials
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────
-- Ahrefs backlinks (Sprint 6)
-- Real backlink rows from the Ahrefs API, owner-scoped, so linking
-- intelligence can use inbound authority instead of internal links only.
-- ─────────────────────────────────────────────

create table if not exists public.ahrefs_backlinks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  url_from text not null,
  url_to text not null,
  domain_from text not null,
  domain_rating int not null default 0,
  anchor text,
  first_seen date,
  last_seen date,
  created_at timestamptz not null default now(),
  unique (owner_id, url_from, url_to)
);

create index if not exists ahrefs_backlinks_owner_idx on public.ahrefs_backlinks (owner_id);
create index if not exists ahrefs_backlinks_to_idx on public.ahrefs_backlinks (url_to);

alter table public.ahrefs_backlinks enable row level security;

create policy "own ahrefs backlinks" on public.ahrefs_backlinks
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Ahrefs sync status (per owner + target)
-- ─────────────────────────────────────────────

create table if not exists public.ahrefs_sync_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  target text not null,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  rows_upserted int not null default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists ahrefs_logs_owner_idx on public.ahrefs_sync_logs (owner_id);

alter table public.ahrefs_sync_logs enable row level security;

create policy "own ahrefs sync logs" on public.ahrefs_sync_logs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
