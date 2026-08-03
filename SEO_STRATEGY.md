# SEO Strategy — Revuvia

## Objective

Rank for **local business + Google reviews + QR code** queries in French and English, with Agadir/Morocco geo modifiers where relevant.

## Pillar clusters

| Pillar | Target keyword theme | Page role |
|--------|---------------------|-----------|
| Google Reviews | avis google, google reviews business | pillar |
| QR Code Reviews | qr code avis google, google review qr | pillar |
| Reputation Management | gestion e-réputation, online reputation local | pillar |
| Local SEO | référencement local, google maps ranking | supporting |
| Industry verticals | restaurant, café, salon, dentist reviews | supporting |

## Keyword fields (Supabase `keywords`)

- `content_status` — planned → brief → writing → review → published → archived
- `page_role` — none | pillar | supporting
- `traffic_estimate`, `expected_leads`, `expected_mrr`
- `intent` — informational | commercial | transactional
- `priority`, `difficulty`, `opportunity_score`

## Weekly SEO Intelligence

Cron: `POST /api/acquisition/seo-intelligence` (Mondays 05:00 UTC)

Actions:

1. Import new queries from GSC not yet in `keywords`
2. Flag content gaps (high opportunity, no article)
3. Archive stale low-volume keywords
4. Reprioritize top opportunities
5. Generate article briefs → Content Factory queue

## Competitors

Track in `competitors` table. Review overlap weekly in SEO Intelligence report.

## Success metrics

- Organic visits (GSC + `daily_metrics`)
- Leads per keyword (`content_roi_snapshots`)
- Paid customers per article (`journey_events.stage = paid`)
