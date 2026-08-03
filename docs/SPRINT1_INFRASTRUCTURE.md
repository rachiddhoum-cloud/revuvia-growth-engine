# Sprint 1 — Infrastructure (Revuvia Growth Engine)

## Goal
Connect the 6 MVP modules to real infrastructure (Supabase, OpenAI, Anthropic, Resend)
with a shared, typed, reliable abstraction layer — and make the app fail-fast on bad config.

## What was built

### Environment validation (`src/lib/env/`)
- `server.ts` — Zod-validates all server-only env vars on first access via `getServerEnv()` (fail-fast, throws with a list of missing/invalid keys). Non-throwing `serverEnvStatus()` for startup validation + `/api/health`.
- `client.ts` — browser-safe `getPublicEnv()`.
- `index.ts` — barrel.

### Reliability (`src/lib/reliability/`)
- `retry.ts` — `withRetry` (exponential backoff, full jitter), `withTimeout`, `isTransientError`, `backoffDelay`. Pure, dependency-free, unit-tested.
- `rate-limit.ts` — `MemoryRateLimiter` (sliding window) + shared `aiRateLimiter` / `emailRateLimiter` instances.

### Logging & monitoring (`src/lib/log/`, `src/lib/monitoring/`)
- Structured logger with secret redaction.
- `recordAiRun` writes `{ module, model, prompt_tokens, completion_tokens, cost_usd, status, owner_id }` to `generation_runs` via the service-role client (fire-and-forget).

### Email (`src/lib/email/`)
- `client.ts` — Resend singleton (`getResend`), `isResendConfigured`, `defaultFrom`.
- `templates.ts` — reusable pure templates (weekly report, lead magnet, campaign, notification).
- `service.ts` — `sendEmail` (retry + timeout) + typed helpers per template.

### Supabase (`src/lib/supabase/`)
- Client factories: server (`@supabase/ssr`), browser, service-role.
- `init.ts` — `ensureProfile` (idempotent upsert) + `checkDbHealth` (timeout-bounded round-trip probe).
- Migration `0002_infrastructure.sql` — storage buckets (`content-assets`, `lead-magnets`), `generation_runs.owner_id` nullable, `ping()` health function, grants.

### HTTP abstraction (`src/lib/http/`)
- `api-error.ts` — typed `ApiError` (status + public message) + `isConfigurationError`.
- `route-handler.ts` — `withRouteHandler` (safe JSON body parsing, optional rate limiting, optional cron-secret gate, unified error mapping → 400/401/429/503/500, structured logging).

### AI layer (`src/lib/ai/`)
- `provider.ts` — `aiComplete(model, { provider, module, ownerId })`: provider fallback on auth errors, `withRetry` + `withTimeout` per attempt, cost tracking via `recordAiRun`.
- `openai.ts` / `anthropic.ts` — SDK `timeout: 90_000`, `maxRetries: 2`; direct `process.env` key checks.
- Every module call now passes its `module` name: `content`, `social`, `seo`, `leadmagnet`.

### API routes (all rewritten to the shared abstraction)
| Route | Status |
| --- | --- |
| `POST /api/seo/analyze` | rewired |
| `POST /api/content/generate` | rewired |
| `POST /api/content/social` | rewired |
| `POST /api/lead-magnets/generate` | rewired |
| `POST /api/calendar/plan` | rewired |
| `GET /api/health` | new — env + Supabase round-trip + service flags |
| `POST /api/reports/weekly` | new — cron-driven weekly report via Resend |

### Startup validation & cron
- `src/instrumentation.ts` — logs/throws on invalid env at server boot (skips the throw during `next build` via `NEXT_PHASE`).
- `vercel.json` — weekly cron: `0 8 * * 1` → `/api/reports/weekly` (protected by `CRON_SECRET` header).
- `next.config.ts` — `serverExternalPackages: ["@supabase/ssr"]`.

## Fixes applied during the sprint
- `src/lib/supabase/index.ts` barrel wrongly aliased `createServerClient` as `createClient` (TS2459).
- `transformToSocial` now accepts `Pick<GeneratedContent, "title" | "excerpt" | "bodyMarkdown">` instead of a full object — removed an `as never` cast in the social route.
- `checkDbHealth` now bounds the probe with `withTimeout` (was an unused param; the Supabase builder is thenable, wrapped with `Promise.resolve()`).
- Lead-magnet route validates `kind` against a `LeadMagnetKind[]` set with a proper cast.

## Verification
```
npx tsc --noEmit   # 0 errors
npm run lint       # 0 errors, 0 warnings
npm run test:unit  # 20/20 passed
npm run build      # success, all routes present
```

## Deploy checklist
1. Set env vars in Vercel / `.env.local` (see `.env.example`): Supabase URL + anon + service-role, `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `REPORT_RECIPIENT_EMAIL`, `CRON_SECRET`, `LOG_LEVEL`.
2. Push migration `0002_infrastructure.sql` to the Supabase project.
3. `vercel.json` cron requires the Hobby (or above) plan.
4. Enable the weekly cron and verify `POST /api/reports/weekly` with the `x-cron-secret` header.
