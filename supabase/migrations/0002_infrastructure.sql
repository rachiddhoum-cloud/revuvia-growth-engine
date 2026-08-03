-- Revuvia Growth Engine — 0002: storage buckets + health + monitoring support
-- Phase 1 (Supabase) and Phase 6 (reliability/monitoring) infrastructure.

-- ─────────────────────────────────────────────
-- Storage buckets
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('content-assets', 'content-assets', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('lead-magnets', 'lead-magnets', true)
on conflict (id) do nothing;

-- Public read for both buckets (covers, lead magnet downloads).
create policy "public read content-assets"
  on storage.objects for select
  using (bucket_id = 'content-assets');

create policy "public read lead-magnets"
  on storage.objects for select
  using (bucket_id = 'lead-magnets');

-- Authenticated write (upload).
create policy "authenticated upload content-assets"
  on storage.objects for insert
  with check (bucket_id = 'content-assets' and auth.role() = 'authenticated');

create policy "authenticated upload lead-magnets"
  on storage.objects for insert
  with check (bucket_id = 'lead-magnets' and auth.role() = 'authenticated');

-- Owners may update/delete their own objects (auth.uid() = owner claim).
create policy "owner update content-assets"
  on storage.objects for update
  using (bucket_id = 'content-assets' and auth.uid() = (storage.foldername(name))[1]::uuid);

create policy "owner delete content-assets"
  on storage.objects for delete
  using (bucket_id = 'content-assets' and auth.uid() = (storage.foldername(name))[1]::uuid);

create policy "owner update lead-magnets"
  on storage.objects for update
  using (bucket_id = 'lead-magnets' and auth.uid() = (storage.foldername(name))[1]::uuid);

create policy "owner delete lead-magnets"
  on storage.objects for delete
  using (bucket_id = 'lead-magnets' and auth.uid() = (storage.foldername(name))[1]::uuid);

-- ─────────────────────────────────────────────
-- Monitoring: allow anonymous (pre-auth) generation runs
-- ─────────────────────────────────────────────
alter table public.generation_runs
  alter column owner_id drop not null;

-- ─────────────────────────────────────────────
-- Health check helper
-- ─────────────────────────────────────────────
create or replace function public.ping()
returns text language sql stable as $$
  select 'pong';
$$;

grant execute on function public.ping() to anon, authenticated, service_role;
