-- Revuvia Growth Engine — 0007: document default owner for GSC / pipeline
--
-- All owner-scoped tables reference profiles(id). Before connecting GSC or
-- running the pipeline against Supabase, set DEFAULT_OWNER_ID in env to a
-- valid profiles.id UUID (from Supabase Auth → Users).
--
-- No seed row is inserted here because profiles.id FK requires auth.users.

comment on table public.profiles is
  'Founder/operator profiles. Set DEFAULT_OWNER_ID env to profiles.id for GSC and pipeline writes.';
