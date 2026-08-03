/**
 * HTTP helpers — typed errors and shared route handler.
 */

export { ApiError, isApiError, isConfigurationError } from "@/lib/http/api-error";
export { withRouteHandler, jsonError } from "@/lib/http/route-handler";
export type { RouteHandlerOptions, RateLimitConfig } from "@/lib/http/route-handler";
