import { safeCompareUtf8 } from "@/lib/security/compare-utf8";
import { OPS_SESSION_COOKIE } from "@/lib/security/ops-session-constants";

export function readCronSecretEdge(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}

export function readOpsSessionTokenEdge(): string | null {
  const explicit = process.env.OPS_SESSION_TOKEN?.trim();
  if (explicit) return explicit;
  return null;
}

export function isCronAuthorizedEdge(request: Request): boolean {
  const secret = readCronSecretEdge();
  if (!secret) return false;

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const cronHeader = request.headers.get("x-cron-secret")?.trim() ?? "";

  return safeCompareUtf8(auth, `Bearer ${secret}`) || safeCompareUtf8(cronHeader, secret);
}

export function isOpsSessionAuthorizedEdge(request: Request): boolean {
  const token = readOpsSessionTokenEdge();
  if (!token) {
    return process.env.NODE_ENV !== "production";
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${OPS_SESSION_COOKIE}=([^;]*)`));
  const cookieValue = match?.[1] ? decodeURIComponent(match[1]) : "";

  if (!cookieValue) return false;
  return safeCompareUtf8(cookieValue, token);
}

export function isApiAuthorizedEdge(request: Request): boolean {
  return isCronAuthorizedEdge(request) || isOpsSessionAuthorizedEdge(request);
}
