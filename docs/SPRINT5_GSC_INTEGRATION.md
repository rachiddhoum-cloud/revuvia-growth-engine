# Sprint 5 — Google Search Console Integration

The Growth Engine stops guessing. Sprint 5 connects real Google Search
Console data (queries, pages, daily metrics) and makes every SEO decision
evidence-based: an OAuth flow, an idempotent incremental sync, five
normalized tables, an opportunity engine, a content generator, linking
intelligence, a real SEO Health Score and a weekly CEO recommendation
report with a 12-week forecast. No dashboards were added.

## 1. Architecture

```
Vercel crons                  server-only orchestrators               pure generators
──────────────                ──────────────────────────              ────────────────
daily 09:00 /api/gsc/sync ──▶ runGscSync()                            src/lib/gsc/*
                                ├─ load credentials (search_console_credentials)
                                ├─ refresh token if expired (OAuth refresh grant)
                                ├─ syncGscData (DI: storage/client/logger)
                                │    ├─ queries, pages, date rows (incremental window)
                                │    ├─ idempotent upserts (natural keys)
                                │    └─ sync_logs (success/partial/failed)
                                ├─ backfill daily_metrics (last 7d)
                                └─ automation chain: weekly loop + CEO report + inbox

Mon 08:30 /api/gsc/recommendations ─▶ loadGscData → buildGscRecommendations()
                                        ├─ buildSeoOpportunities      (7 detectors, ICE)
                                        ├─ buildContentOpportunities  (6 kinds)
                                        ├─ buildLinkingIntel          (4 kinds)
                                        ├─ buildSeoHealthScore        (8 dimensions, trend)
                                        └─ buildForecast              (12-week traffic + MRR)
                                        └─ persist reports (seo_health, gsc_recommendations)

OAuth (on demand)            /api/gsc/connect → Google → /api/gsc/callback → store tokens
                             /api/gsc/disconnect → purge all GSC rows for the owner
```

## 2. OAuth (Phase 1)

- `GET /api/gsc/connect` builds the Google authorization URL
  (`scope: webmasters.readonly`, `access_type: offline`, `prompt: consent`,
  state carries `ownerId`).
- `GET /api/gsc/callback` exchanges the code via
  `exchangeAuthorizationCode()` (pure, injectable fetcher), lists verified
  sites, upserts `search_console_credentials` (access + refresh token,
  expiry) and `search_console_sites`, then redirects to `/settings`.
- `POST /api/gsc/disconnect` (cron-secret gated) deletes all six tables for
  the owner.
- Access tokens are never exposed to the client; only the server wrapper
  (`sync.ts`) touches them. Refresh happens automatically when `expires_at`
  is near, 60 s margin.
- Required env: `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REDIRECT_URI`
  (validated in `src/lib/env/server.ts`).

## 3. Database (migration 0006)

| Table | Natural key (upsert conflict) | Purpose |
| --- | --- | --- |
| `search_console_credentials` | `owner_id` | one row per owner: site, tokens, expiry, last sync |
| `search_console_sites` | `owner_id, site_url` | verified properties |
| `search_console_queries` | `owner_id, site_url, query, search_type, date` | daily query rows (clicks, impressions, ctr, position) |
| `search_console_pages` | `owner_id, site_url, url, search_type, date` | daily page rows |
| `search_console_daily_metrics` | `owner_id, site_url, date, search_type` | aggregated daily totals |
| `search_console_sync_logs` | `id` | sync status + row counts + window + error |

All tables: RLS enabled with `owner_id = auth.uid()` policies, indexes on
date (desc) and clicks/impressions (desc). `reports.type` extended with
`seo_health` and `gsc_recommendations`. The `set_updated_at` trigger (0001)
applies.

## 4. Sync (Phases 2-3)

- **Connector** (`connector.ts`): DI fetcher, 3 retries with exponential
  backoff on 429/5xx, minimum interval rate limiting, search analytics +
  site listing, pagination.
- **Core** (`core.ts`): pure window planning — first sync pulls 28 days,
  then resumes the day after the last successful sync; every row mapped and
  aggregated; chunks of 500 for persistence.
- **Orchestrator** (`sync-core.ts`): full DI (credentials, storage, client,
  logger) → fully unit-tested with in-memory stores; fetches all pages of
  query/page/date data, idempotent upserts, writes sync logs.
- **Wrapper** (`sync.ts`, server-only): Supabase storage implementation,
  automatic token refresh, `daily_metrics` backfill, then the automation
  chain (weekly loop, CEO report, founder inbox) — each step isolated in
  `Promise.allSettled` so one failure never blocks the rest.

## 5. Engines (Phases 5-9)

| Engine | File | Detectors | ICE/ROI |
| --- | --- | --- | --- |
| Opportunity engine | `opportunities.ts` | losing traffic, losing ranking, low CTR (benchmark 2.5%), stuck 8-20, declining clicks, no internal links, stale content | ICE + weekly traffic gain + monthly ROI |
| Content generator | `content-opps.ts` | new articles, refreshes, cluster expansion, FAQ blocks, featured snippets, long-tail depth | ICE + traffic + ROI |
| Linking intelligence | `linking-intel.ts` | orphans, weak links, authority flow, contextual gaps | ICE + traffic gain |
| SEO Health Score | `health-score.ts` | visibility, traffic, click-through, ranking, momentum, freshness, link coverage, distribution | weighted 0-100 + trend |
| CEO recommendations | `recommendations.ts` | losing/winning pages, rising/falling queries, quick wins, content roadmap, 12-week forecast | ICE priorities |

The real health score replaces the simulated SEO dimension of the Growth
Score when provided (`buildGrowthScore({ seoHealth })`).

## 6. Error recovery

- GSC API failures: retried 3x with backoff, then `partial`/`failed` sync
  log — the next cron resumes the day after the last success.
- Token expired: auto-refresh before every sync.
- Missing env: routes return 503 with a clear message.
- Automation step failure: logged, never aborts the sync response.

## 7. Security

- Tokens stored in `search_console_credentials`, RLS-restricted, never sent
  to the browser.
- Callback state carries the owner id (base64url, not signed — acceptable
  for the single-owner deployment; swap to signed state before multi-tenant).
- All cron routes gated by `x-cron-secret` (`CRON_SECRET`).

## 8. Deployment

1. Create a Google Cloud project, enable the Search Console API, create an
   OAuth client (Web), add the redirect URI
   `https://<app>/api/gsc/callback`.
2. Set `GSC_CLIENT_ID`, `GSC_CLIENT_SECRET`, `GSC_REDIRECT_URI` in Vercel.
3. Run migration `0006_gsc.sql`.
4. Open `/api/gsc/connect` once to authorize; the app stores the refresh
   token.
5. The `daily 09:00` sync and `Mon 08:30` recommendations crons then run
   autonomously.

## 9. Business impact

- SEO work is now prioritized by real data (ICE), not guesses.
- The weekly recommendation report gives the founder a single, quantified
  view: health score, quick wins, roadmap and 12-week traffic/MRR forecast.
- Every artifact improves Traffic → Leads → Trials → Paid → MRR.

## 10. Validation

- 8 new test files in `src/lib/gsc` (connector, core, sync-core, opportunities,
  content-opps, linking-intel, health-score, recommendations).
- Full suite: tsc 0, lint 0, 307/307 tests, build OK (expected dynamic-route
  warnings).

## 11. Next steps

- Signed OAuth state + multi-owner support.
- GSC approval UI on `/settings` (connect/disconnect, last sync status).
- Connect LinkedIn/Facebook/X real publishing APIs (Sprint 4 placeholders).
