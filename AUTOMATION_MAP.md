# Automation Map — Customer Acquisition

All crons require `CRON_SECRET` (Bearer or `x-cron-secret` header).

## Daily

| Time (UTC) | Route | Action |
|------------|-------|--------|
| 06:30 | `/api/ops/brief` | Legacy ops brief |
| 07:00 | `/api/acquisition/nurture` | Send due nurture emails |
| 07:15 | `/api/ops/inbox` | Legacy founder inbox |
| 07:20 | `/api/acquisition/briefing` | CAS 2-min founder briefing |
| 08:30 | `/api/ops/publish` | Social publishing queue |
| 09:00 | `/api/gsc/sync` | GSC metrics sync |

## Weekly (Mondays)

| Time (UTC) | Route | Action |
|------------|-------|--------|
| 04:00 | `/api/learning/cycle` | Global learning patterns |
| 05:00 | `/api/acquisition/seo-intelligence` | Keywords, gaps, briefs, archive |
| 05:05 | `/api/ops/execute` | SEO loop, calendar, opportunities |
| 05:30 | `/api/acquisition/learning` | CAS ROI learning + recommendations |
| 07:45 | `/api/acquisition/dashboard` | Persist CAS dashboard snapshot |
| 08:00 | `/api/reports/weekly` | Weekly report email |

## Weekdays (sales)

| Time (UTC) | Route | Action |
|------------|-------|--------|
| 07:30 | `/api/sales/daily` | Top-20 outreach queue |

## Public (always on)

| Route | Trigger |
|-------|---------|
| `POST /api/public/leads` | CTA form submit on marketing site |
| `POST /api/public/cta` | CTA impression/click/conversion pixel |
| `GET /api/public/cta` | Load CTA config for article embed |

## Manual ops

- `/content-hub` — review keyword pipeline
- `/acquisition` — founder dashboard
- `/sales` — prioritized prospects + message preview
- `/journey` — funnel health

## Environment

| Variable | Purpose |
|----------|---------|
| `DEFAULT_OWNER_ID` | Single-tenant owner UUID |
| `CRON_SECRET` | Secures all cron routes |
| `RESEND_API_KEY` | Nurture email delivery |
| `NURTURE_FROM_EMAIL` | Sender for nurture sequence |

## Verify before deploy

```bash
npm run verify
```

Apply migration `0012_customer_acquisition_system.sql` on Supabase first.
