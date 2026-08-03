# Sprint 6 — Production integrations & hardening

Sprint 6 closes the remaining "next steps": signed OAuth state, real social
publishing (LinkedIn / Facebook / X), Ahrefs backlinks into the linking
intelligence, and the Settings UI to manage both. The Growth Engine now
publishes real content and scores pages with real inbound authority.

## 1. Signed OAuth state

- `src/lib/gsc/oauth-state.ts` — HMAC-SHA256 signed `state`:
  `base64url(payload).base64url(signature)`, payload carries `ownerId` + `exp`
  (10 min TTL).
- `/api/gsc/connect` builds the signed state; `/api/gsc/callback` verifies it
  with `timingSafeEqual` and rejects `missing` / `tampered` / `expired`
  states with a redirect to `/settings?gsc=error&reason=...`.
- Secret: `OAUTH_STATE_SECRET` (falls back to `CRON_SECRET`), validated
  (≥ 16 chars) in `src/lib/env/server.ts`.

## 2. Real social publishing (LinkedIn / Facebook / X)

| Piece | Location |
| --- | --- |
| Connectors (DI fetcher, real endpoints) | `src/lib/social/connectors.ts` |
| Tests (5) | `src/lib/social/connectors.test.ts` |
| Credentials table + RLS | migration `0007_social_ahrefs.sql` (`social_credentials`) |
| Credentials API (GET/POST/DELETE) | `/api/social/credentials` |
| Settings UI (token paste per platform) | `src/components/settings/social-settings-client.tsx` + `/settings` |

Publishing cron (`runPublishing`): when a due social slot has a credential
for its platform, the engine **POSTs real content** via the platform API and
stores `external_url`; on API failure the post stays `scheduled` for the next
cron retry. Without credentials it falls back to the previous local-only
marking (no regression).

- LinkedIn: UGC posts API (`/v2/ugcPosts`, PUBLIC visibility).
- Facebook: Graph API `/v21.0/{page_id}/feed` (link post).
- X: `/2/tweets`, text truncated to 280 chars.

## 3. Ahrefs backlinks

| Piece | Location |
| --- | --- |
| Connector (v4, cursor pagination, retries/backoff) | `src/lib/ahrefs/connector.ts` |
| Tests (4) | `src/lib/ahrefs/connector.test.ts` |
| DI sync orchestrator (idempotent upserts, logs) | `src/lib/ahrefs/sync.ts` |
| Tests (3) | `src/lib/ahrefs/sync.test.ts` |
| Server wrapper (Supabase storage) | `src/lib/ahrefs/server.ts` |
| Tables + RLS | migration 0007 (`ahrefs_backlinks`, `ahrefs_sync_logs`) |
| Cron | `/api/ahrefs/sync`, Tue 09:30 |

Env: `AHREFS_API_TOKEN`, `AHREFS_TARGET` (validated in env schema).

The linking intelligence now receives real inbound authority:
`zeroAuthorityPages()` flags pages with traffic but **no internal links and
no backlinks** as the highest-priority targets, and `loadGscData` merges
internal link counts + Ahrefs backlink counts. The weekly CEO report gains a
"Linking intelligence" section.

## 4. Settings UI

`/settings` now shows:
- GSC card (connect / sync now / disconnect, sites, last sync, row counts) —
  existing.
- Social publishing card (per-platform connect/update/disconnect with token
  paste + account id) — new.

## 5. Security

- Tokens (GSC + social) stored in RLS-protected tables, never sent to the
  client; access token fields are server-only.
- OAuth state signed + expiring (CSRF protection).
- All cron routes gated by `x-cron-secret`.
- Env validation for every new variable.

## 6. Deployment

1. Run migration `0007_social_ahrefs.sql`.
2. Set `OAUTH_STATE_SECRET`, `AHREFS_API_TOKEN`, `AHREFS_TARGET` (+ existing
   GSC vars).
3. On `/settings`, paste LinkedIn/Facebook/X tokens (page access tokens for
   real publishing).
4. The daily publishing cron (08:00) and weekly Ahrefs cron (Tue 09:30) run
   autonomously.

## 7. Validation

- New tests: oauth-state (6), social connectors (5), ahrefs connector (4),
  ahrefs sync (3), linking-intel +1 (6 total) — suite at **332/332**.
- tsc 0, lint 0, build OK (expected dynamic-route warnings).

## 8. Next steps

- OAuth flows per platform (login-based tokens) instead of token paste.
- Instagram/WhatsApp/Email channels in the publishing cron.
- Backlink-driven outreach queue (pages with zero backlinks → link-building
  tasks in the execution calendar).
