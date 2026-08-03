# Content Strategy — Revuvia

## Content types

| Kind | Purpose | CTA default |
|------|---------|-------------|
| Pillar article | Own a topic cluster | Start Free Trial |
| Supporting article | Long-tail + internal links | Review Audit / QR Generator |
| Landing | Campaign / geo pages | Start Free |
| Lead magnet | Email capture | Download + nurture enroll |
| FAQ | SERP snippets | Calculate review potential |

## CTA types (`content_ctas`)

- `qr_generator` — Create your Google Review QR Code
- `review_potential` — Calculate your review potential
- `review_audit` — Free Review Audit
- `start_free` — Start Free (`revuvia.com/register`)
- `trial`, `demo`, `download`, `custom`

Each CTA is configurable per article: label, destination URL, position (hero/inline/sidebar/footer).

## Production flow

1. Keyword enters Content Hub as `planned`
2. SEO Intelligence generates brief → `brief`
3. Content Factory generates draft → `writing` / `review`
4. Approval → publish → `published`
5. CTAs attached in `content_ctas`
6. Public embed calls `/api/public/cta` + `/api/public/leads`

## Internal linking

Use existing linking engine (`lib/linking`) — every supporting article links to its pillar.

## Lead magnets

Existing module `/lead-magnets` — downloads tracked in `lead_magnet_downloads` and mirrored into `acquisition_leads`.

## Quality bar

- Meta title ≤ 60 chars, meta description ≤ 155
- One primary CTA above the fold
- French-first for Morocco market; English variants for export SEO
