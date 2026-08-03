-- Seed nurture funnel for founder owner (fixes 0012 fallback owner miss)
insert into public.nurture_sequences (id, owner_id, name, trigger, is_active)
select 'a1000000-0000-4000-8000-000000000001'::uuid, '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 'Revuvia Welcome Funnel', 'lead_capture', true
where not exists (select 1 from public.nurture_sequences where id = 'a1000000-0000-4000-8000-000000000001'::uuid);

insert into public.nurture_steps (sequence_id, owner_id, step_order, delay_hours, template_key, subject, body_markdown)
select v.sequence_id, v.owner_id, v.step_order, v.delay_hours, v.template_key, v.subject, v.body_markdown
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 1, 0, 'welcome', 'Bienvenue sur Revuvia', 'Merci pour votre intérêt. Revuvia vous aide à collecter plus d''avis Google avec un QR imprimable.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 2, 48, 'education', 'Comment doubler vos avis Google en 30 jours', 'Voici 3 actions simples pour votre établissement.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 3, 120, 'case_study', 'Cas client : +40% d''avis en 2 semaines', 'Un café à Agadir a transformé son comptoir avec Revuvia.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 4, 168, 'objection', 'FAQ : est-ce compliqué à installer ?', 'Non — 15 minutes, QR imprimable, essai Pro 14 jours sans carte.'),
  ('a1000000-0000-4000-8000-000000000001'::uuid, '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 5, 240, 'limited_offer', 'Essai Pro 14 jours — places limitées Agadir', 'Démarrez gratuitement : https://revuvia.com/register')
) as v(sequence_id, owner_id, step_order, delay_hours, template_key, subject, body_markdown)
where not exists (select 1 from public.nurture_steps where sequence_id = 'a1000000-0000-4000-8000-000000000001'::uuid);

-- Revuvia marketing embed content + CTAs
insert into public.content_items (id, owner_id, kind, title, slug, status, excerpt) values
  ('b2000000-0000-4000-8000-000000000001', '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9', 'landing', 'Revuvia Home — CTA mid', 'revuvia-home-mid', 'published', 'Mid-page acquisition CTA'),
  ('b2000000-0000-4000-8000-000000000002', '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9', 'landing', 'Revuvia Home — CTA final', 'revuvia-home-final', 'published', 'Final acquisition CTA'),
  ('b2000000-0000-4000-8000-000000000003', '3588dae8-8c7d-494b-b9d2-9e0a539fa5d9', 'landing', 'Revuvia Pricing CTA', 'revuvia-pricing', 'published', 'Pricing page CTA')
on conflict (id) do nothing;

insert into public.content_ctas (owner_id, content_item_id, label, cta_type, destination_url, position, is_primary, sort_order)
select v.owner_id, v.content_item_id, v.label, v.cta_type, v.destination_url, v.position, true, 1
from (values
  ('3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 'b2000000-0000-4000-8000-000000000001'::uuid, 'Audit avis Google gratuit', 'review_audit', 'https://revuvia.com/register', 'inline'),
  ('3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 'b2000000-0000-4000-8000-000000000002'::uuid, 'Créer votre QR code avis Google', 'qr_generator', 'https://revuvia.com/register', 'footer'),
  ('3588dae8-8c7d-494b-b9d2-9e0a539fa5d9'::uuid, 'b2000000-0000-4000-8000-000000000003'::uuid, 'Essai Pro 14 jours — gratuit', 'start_free', 'https://revuvia.com/register', 'hero')
) as v(owner_id, content_item_id, label, cta_type, destination_url, position)
where not exists (
  select 1 from public.content_ctas c where c.content_item_id = v.content_item_id and c.label = v.label
);
