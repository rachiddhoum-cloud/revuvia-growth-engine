# Customer Acquisition Architecture

Revuvia Growth Engine — Customer Acquisition System (CAS). This stack acquires paying customers for Revuvia. It does **not** modify Revuvia billing or product logic.

## Goal

One closed loop:

**Traffic → Lead → Nurture → Trial/Paid → Measure ROI → Learn → Repeat**

## Layers

| Layer | Module | Storage |
|-------|--------|---------|
| Content Hub | `src/lib/acquisition/content-hub.ts` | `keywords`, `keyword_clusters`, `content_items` |
| Lead Capture | `src/lib/acquisition/lead-capture.ts` | `acquisition_leads`, `content_ctas`, `cta_conversions` |
| Nurture | `src/lib/acquisition/nurture.ts` | `nurture_sequences`, `nurture_steps`, `nurture_enrollments`, `nurture_events` |
| Journey | `src/lib/acquisition/journey.ts` | `journey_events` |
| SEO Intelligence | `src/lib/acquisition/seo-intelligence.ts` | `keywords`, `competitors`, GSC tables |
| Sales Intelligence | `src/lib/acquisition/sales-priority.ts` | `prospects`, `prospect_messages` |
| Dashboard | `src/lib/acquisition/dashboard.ts` | `reports` (`cas_dashboard`) |
| Learning | `src/lib/acquisition/learning.ts` | `content_roi_snapshots`, `reports` (`cas_learning`) |
| Founder Inbox | `src/lib/acquisition/founder-briefing.ts` | `reports` (`founder_inbox`) |

## Public APIs (embed on Revuvia marketing site)

- `POST /api/public/leads` — capture email + attribution
- `GET /api/public/cta?contentItemId=` — list CTAs for an article
- `POST /api/public/cta` — track impression / click / conversion

## Ops UI

| Route | Purpose |
|-------|---------|
| `/acquisition` | Founder marketing dashboard |
| `/content-hub` | SEO keyword pipeline |
| `/journey` | Funnel visualization |
| `/sales` | Prioritized prospects |
| `/inbox` | 2-minute morning briefing |

## Cron automation

See `AUTOMATION_MAP.md` and `vercel.json`.

## Migration

Apply `supabase/migrations/0012_customer_acquisition_system.sql` before deploying.

## Boundaries

- Growth Engine owns acquisition data and outreach.
- Revuvia SaaS owns auth, billing, entitlements, and product UX.
- Sync paid status into `acquisition_leads` / `journey_events` via webhooks or manual ops (future integration point).
