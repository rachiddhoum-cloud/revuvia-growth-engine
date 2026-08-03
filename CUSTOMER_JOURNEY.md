# Customer Journey

## Stages

1. **anonymous** — visitor lands on content (tracked via `journey_events` + GSC)
2. **lead** — email captured via CTA or lead magnet (`acquisition_leads`)
3. **registered** — creates Revuvia account (`revuvia.com/register`)
4. **trial** — starts Pro trial (14 days)
5. **paid** — Lemon Squeezy subscription active
6. **cancelled** — churned customer
7. **recovered** — win-back after cancellation

## Event model

Table: `journey_events`

Each row records a stage transition with optional:

- `visitor_id` — anonymous cookie/fingerprint
- `lead_id` — FK to `acquisition_leads`
- `email`
- `channel` — organic, cta, outreach, referral…
- `content_item_id` — attributing article
- `cta_id` — attributing CTA
- `revenue_usd` — MRR at conversion time

## Funnel metrics

UI: `/journey`

Conversion rate between stages = `stage[n] / stage[n-1]` over rolling 30 days.

## Integration with Revuvia

Revuvia product events (signup, trial, payment) should emit journey events into Growth Engine Supabase (read-only webhook or nightly sync). **Do not change Revuvia billing code** — add a thin acquisition webhook later.

## Nurture alignment

Lead capture auto-enrolls `Revuvia Welcome Funnel` (`nurture_sequences` seed in migration 0012).

Steps: Welcome → Education → Case study → Objection → Limited offer.
