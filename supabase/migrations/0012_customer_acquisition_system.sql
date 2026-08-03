-- Revuvia Growth Engine — 0012: Customer Acquisition System (CAS)
-- Phases 1–9: content hub fields, CTAs, leads, nurture, journey, ROI learning.
-- Does NOT touch Revuvia SaaS billing — acquisition data only.

-- ---------------------------------------------------------------------------
-- Keywords: SEO content hub extensions
-- ---------------------------------------------------------------------------
alter table public.keywords add column if not exists content_status text
  default 'planned'
  check (content_status in ('planned', 'brief', 'writing', 'review', 'published', 'archived'));
alter table public.keywords add column if not exists page_role text
  default 'none'
  check (page_role in ('none', 'pillar', 'supporting'));
alter table public.keywords add column if not exists traffic_estimate int default 0;
alter table public.keywords add column if not exists expected_leads int default 0;
alter table public.keywords add column if not exists expected_mrr numeric default 0;
alter table public.keywords add column if not exists archived_at timestamptz;
alter table public.keywords add column if not exists content_item_id uuid
  references public.content_items (id) on delete set null;

create index if not exists keywords_content_status_idx
  on public.keywords (project_id, content_status);
create index if not exists keywords_page_role_idx
  on public.keywords (project_id, page_role);

-- ---------------------------------------------------------------------------
-- Configurable CTAs on content (Phase 2)
-- ---------------------------------------------------------------------------
create table if not exists public.content_ctas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  label text not null,
  cta_type text not null
    check (cta_type in (
      'qr_generator', 'review_potential', 'review_audit',
      'start_free', 'trial', 'demo', 'download', 'custom'
    )),
  destination_url text not null default 'https://revuvia.com/register',
  position text not null default 'inline'
    check (position in ('hero', 'inline', 'sidebar', 'footer')),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_ctas_item_idx on public.content_ctas (content_item_id, sort_order);

alter table public.content_ctas enable row level security;
create policy "own content ctas" on public.content_ctas
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- CTA conversion events
-- ---------------------------------------------------------------------------
create table if not exists public.cta_conversions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  cta_id uuid references public.content_ctas (id) on delete set null,
  content_item_id uuid references public.content_items (id) on delete set null,
  event_type text not null check (event_type in ('impression', 'click', 'conversion')),
  visitor_id text,
  email text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists cta_conversions_owner_idx on public.cta_conversions (owner_id, created_at desc);
create index if not exists cta_conversions_cta_idx on public.cta_conversions (cta_id, event_type);

alter table public.cta_conversions enable row level security;
create policy "own cta conversions" on public.cta_conversions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Unified acquisition leads (Phase 2 capture)
-- ---------------------------------------------------------------------------
create table if not exists public.acquisition_leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  full_name text,
  company text,
  phone text,
  source text not null default 'organic'
    check (source in ('organic', 'content', 'cta', 'lead_magnet', 'outreach', 'referral', 'paid', 'other')),
  content_item_id uuid references public.content_items (id) on delete set null,
  cta_id uuid references public.content_ctas (id) on delete set null,
  keyword_id uuid references public.keywords (id) on delete set null,
  prospect_id uuid references public.prospects (id) on delete set null,
  visitor_id text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  status text not null default 'new'
    check (status in ('new', 'nurturing', 'qualified', 'registered', 'trial', 'paid', 'lost', 'unsubscribed')),
  revuvia_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists acquisition_leads_owner_idx on public.acquisition_leads (owner_id, created_at desc);
create index if not exists acquisition_leads_email_idx on public.acquisition_leads (owner_id, email);
create index if not exists acquisition_leads_status_idx on public.acquisition_leads (owner_id, status);

alter table public.acquisition_leads enable row level security;
create policy "own acquisition leads" on public.acquisition_leads
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Nurture sequences (Phase 3)
-- ---------------------------------------------------------------------------
create table if not exists public.nurture_sequences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  trigger text not null default 'lead_capture'
    check (trigger in ('lead_capture', 'magnet_download', 'trial_start', 'trial_expiring', 'manual')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nurture_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.nurture_sequences (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  step_order int not null default 1,
  delay_hours int not null default 24,
  template_key text not null,
  subject text not null,
  body_markdown text not null default '',
  created_at timestamptz not null default now(),
  unique (sequence_id, step_order)
);

create table if not exists public.nurture_enrollments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  sequence_id uuid not null references public.nurture_sequences (id) on delete cascade,
  lead_id uuid not null references public.acquisition_leads (id) on delete cascade,
  current_step int not null default 0,
  status text not null default 'active'
    check (status in ('active', 'completed', 'paused', 'unsubscribed')),
  next_send_at timestamptz,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (sequence_id, lead_id)
);

create table if not exists public.nurture_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  enrollment_id uuid not null references public.nurture_enrollments (id) on delete cascade,
  step_id uuid references public.nurture_steps (id) on delete set null,
  event_type text not null
    check (event_type in ('sent', 'delivered', 'open', 'click', 'conversion', 'unsubscribe', 'bounce', 'failed')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists nurture_events_enrollment_idx
  on public.nurture_events (enrollment_id, created_at desc);

alter table public.nurture_sequences enable row level security;
alter table public.nurture_steps enable row level security;
alter table public.nurture_enrollments enable row level security;
alter table public.nurture_events enable row level security;

create policy "own nurture sequences" on public.nurture_sequences
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own nurture steps" on public.nurture_steps
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own nurture enrollments" on public.nurture_enrollments
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "own nurture events" on public.nurture_events
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Customer journey events (Phase 4)
-- ---------------------------------------------------------------------------
create table if not exists public.journey_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  visitor_id text,
  lead_id uuid references public.acquisition_leads (id) on delete set null,
  email text,
  stage text not null
    check (stage in (
      'anonymous', 'lead', 'registered', 'trial', 'paid', 'cancelled', 'recovered'
    )),
  channel text,
  content_item_id uuid references public.content_items (id) on delete set null,
  cta_id uuid references public.content_ctas (id) on delete set null,
  revenue_usd numeric default 0,
  metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists journey_events_owner_idx on public.journey_events (owner_id, occurred_at desc);
create index if not exists journey_events_stage_idx on public.journey_events (owner_id, stage);
create index if not exists journey_events_visitor_idx on public.journey_events (visitor_id);

alter table public.journey_events enable row level security;
create policy "own journey events" on public.journey_events
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Content ROI learning (Phase 8)
-- ---------------------------------------------------------------------------
create table if not exists public.content_roi_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  content_item_id uuid references public.content_items (id) on delete set null,
  keyword_id uuid references public.keywords (id) on delete set null,
  period_start date not null,
  period_end date not null,
  visits int default 0,
  leads int default 0,
  trials int default 0,
  paid_customers int default 0,
  mrr_usd numeric default 0,
  cta_clicks int default 0,
  email_opens int default 0,
  email_clicks int default 0,
  channel text,
  created_at timestamptz not null default now()
);

create index if not exists content_roi_period_idx
  on public.content_roi_snapshots (owner_id, period_start desc);

alter table public.content_roi_snapshots enable row level security;
create policy "own content roi" on public.content_roi_snapshots
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Default nurture sequence (Revuvia welcome funnel)
-- ---------------------------------------------------------------------------
insert into public.nurture_sequences (id, owner_id, name, trigger, is_active)
select
  'a1000000-0000-4000-8000-000000000001'::uuid,
  '00000000-0000-4000-8000-000000000001'::uuid,
  'Revuvia Welcome Funnel',
  'lead_capture',
  true
where exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000001'::uuid)
  and not exists (select 1 from public.nurture_sequences where id = 'a1000000-0000-4000-8000-000000000001'::uuid);

insert into public.nurture_steps (sequence_id, owner_id, step_order, delay_hours, template_key, subject, body_markdown)
select v.sequence_id, v.owner_id, v.step_order, v.delay_hours, v.template_key, v.subject, v.body_markdown
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 1, 0, 'welcome', 'Bienvenue sur Revuvia', 'Merci pour votre intérêt. Revuvia vous aide à collecter plus d''avis Google avec un QR imprimable.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 2, 48, 'education', 'Comment doubler vos avis Google en 30 jours', 'Voici 3 actions simples pour votre établissement.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 3, 120, 'case_study', 'Cas client : +40% d''avis en 2 semaines', 'Un café à Agadir a transformé son comptoir avec Revuvia.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 4, 168, 'objection', 'FAQ : est-ce compliqué à installer ?', 'Non — 15 minutes, QR imprimable, essai Pro 14 jours sans carte.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid, 5, 240, 'limited_offer', 'Essai Pro 14 jours — places limitées Agadir', 'Démarrez gratuitement : https://revuvia.com/register')
) as v(sequence_id, owner_id, step_order, delay_hours, template_key, subject, body_markdown)
where exists (select 1 from public.profiles where id = '00000000-0000-4000-8000-000000000001'::uuid)
  and not exists (select 1 from public.nurture_steps where sequence_id = 'a1000000-0000-4000-8000-000000000001'::uuid);

-- Reports: CAS artifact types
alter table public.reports drop constraint if exists reports_type_check;
alter table public.reports add constraint reports_type_check
  check (type in (
    'weekly', 'monthly', 'audit', 'action_plan', 'daily_brief', 'ceo', 'linking_plan',
    'seo_loop', 'lead_loop', 'opportunities', 'execution_calendar', 'founder_inbox',
    'growth_score', 'seo_health', 'gsc_recommendations', 'outreach_plan', 'learning_insights',
    'sales_pipeline', 'sales_queue', 'sales_analytics', 'ceo_sales', 'sales_briefing',
    'cas_dashboard', 'cas_journey', 'cas_learning', 'seo_intelligence_weekly'
  ));
