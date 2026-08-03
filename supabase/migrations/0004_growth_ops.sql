-- Revuvia Growth Engine — 0004: growth operating system
-- Sprint 3: customers (MRR), prospects (sales command center),
-- and extended report types for the weekly action plan / daily brief / CEO report.

-- ─────────────────────────────────────────────
-- Customers (trial / paid / MRR)
-- ─────────────────────────────────────────────
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  company text,
  industry text,
  status text not null default 'lead'
    check (status in ('lead', 'trial', 'paid', 'churned')),
  plan text, -- e.g. 'starter' | 'pro'
  mrr_usd numeric not null default 0,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, email)
);

create index if not exists customers_status_idx on public.customers (owner_id, status);

alter table public.customers enable row level security;

create policy "own customers" on public.customers
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Prospects (sales command center)
-- ─────────────────────────────────────────────
create table if not exists public.prospects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  company text not null,
  industry text,
  contact_name text,
  email text,
  priority_score int not null default 0, -- 0-100
  status text not null default 'new'
    check (status in ('new', 'contacted', 'replied', 'demo', 'closed', 'lost')),
  last_interaction_at timestamptz,
  recommended_message text,
  follow_up_at timestamptz,
  probability numeric not null default 0, -- 0-1
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, company)
);

create index if not exists prospects_priority_idx on public.prospects (owner_id, priority_score desc);

alter table public.prospects enable row level security;

create policy "own prospects" on public.prospects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ─────────────────────────────────────────────
-- Reports: extended types (weekly action plan, daily brief, CEO report)
-- ─────────────────────────────────────────────
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports
  add constraint reports_type_check
  check (type in ('weekly', 'monthly', 'audit', 'action_plan', 'daily_brief', 'ceo'));
