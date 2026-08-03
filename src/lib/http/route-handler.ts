/**
 * Shared route handler: consistent error mapping, rate limiting, logging.
 * Removes duplicated try/catch + error-mapping logic from every API route.
 */

import { NextResponse } from "next/server";

import { ApiError, isApiError, isConfigurationError } from "@/lib/http/api-error";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { MemoryRateLimiter } from "@/lib/reliability/rate-limit";
import { logger } from "@/lib/log/logger";

export interface RateLimitConfig {
  limiter: MemoryRateLimiter;
  /** Extra key suffix (e.g. a user id) combined with the client IP. */
  keyPrefix?: string;
}

export interface RouteHandlerOptions {
  rateLimit?: RateLimitConfig;
  /** Cron routes: require valid Bearer or x-cron-secret (fail-closed if CRON_SECRET unset). */
  requireCronAuth?: boolean;
}

type RouteContext = { ip: string };

/**
 * Wraps a route handler function with:
 * - JSON body parsing (safe)
 * - optional rate limiting
 * - unified error -> NextResponse mapping
 * - structured logging of failures
 */
export function withRouteHandler<TBody = unknown, TResult = unknown>(
  handler: (body: TBody, ctx: RouteContext) => Promise<NextResponse<TResult>>,
  options: RouteHandlerOptions = {}
): (request: Request) => Promise<NextResponse> {
  return async (request: Request): Promise<NextResponse> => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

    try {
      if (options.requireCronAuth && !isCronAuthorized(request)) {
        throw ApiError.unauthorized("Invalid cron secret");
      }

      if (options.rateLimit) {
        const { limiter, keyPrefix } = options.rateLimit;
        const result = limiter.consume(`${keyPrefix ?? "route"}:${ip}`);
        if (!result.ok) {
          const err = ApiError.rateLimited(undefined, result.retryAfterSeconds);
          return NextResponse.json(
            { error: err.publicMessage },
            {
              status: 429,
              headers: { "Retry-After": String(result.retryAfterSeconds) },
            }
          );
        }
      }

      let body = {} as TBody;
      if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
        const raw = await request.text();
        if (raw) {
          try {
            body = JSON.parse(raw) as TBody;
          } catch {
            throw ApiError.badRequest("Invalid JSON body");
          }
        }
      }

      return await handler(body, { ip });
    } catch (err) {
      if (isApiError(err)) {
        logger.warn("api request rejected", { status: err.status, ip }, err);
        return NextResponse.json({ error: err.publicMessage }, { status: err.status });
      }

      logger.error("api request failed", { ip }, err);
      const status = isConfigurationError(err) ? 503 : 500;
      const message =
        status === 503
          ? "Service configuration is incomplete. Check server environment."
          : "Internal server error";
      return NextResponse.json({ error: message }, { status });
    }
  };
}

/** Convenience: build the standard `{ error }` failure body. */
export function jsonError(status: number, message: string, headers?: Record<string, string>): NextResponse {
  return NextResponse.json({ error: message }, { status, headers });
}
