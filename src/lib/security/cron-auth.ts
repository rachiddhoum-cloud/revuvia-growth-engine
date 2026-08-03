import { safeCompare } from "@/lib/security/compare";

export function readCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}

/**
 * Validates Vercel Cron (`Authorization: Bearer`) and legacy `x-cron-secret`.
 * Fails closed when CRON_SECRET is unset.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = readCronSecret();
  if (!secret) return false;

  const auth = request.headers.get("authorization")?.trim() ?? "";
  const cronHeader = request.headers.get("x-cron-secret")?.trim() ?? "";

  return safeCompare(auth, `Bearer ${secret}`) || safeCompare(cronHeader, secret);
}
