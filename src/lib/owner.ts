/**
 * Default owner resolution for single-tenant MVP mode.
 *
 * Set DEFAULT_OWNER_ID in env to a valid profiles.id UUID (from Supabase Auth).
 * The legacy alias "system" maps to the same env/default value.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Fallback when DEFAULT_OWNER_ID is unset — must exist in `profiles`. */
export const FALLBACK_OWNER_ID = "00000000-0000-4000-8000-000000000001";

export function resolveOwnerId(value?: string | null): string {
  const fromEnv = process.env.DEFAULT_OWNER_ID?.trim();
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (trimmed === "system") {
      return fromEnv && UUID_RE.test(fromEnv) ? fromEnv : FALLBACK_OWNER_ID;
    }
    if (UUID_RE.test(trimmed)) return trimmed;
  }
  return fromEnv && UUID_RE.test(fromEnv) ? fromEnv : FALLBACK_OWNER_ID;
}

export function isValidOwnerId(value: string): boolean {
  return UUID_RE.test(value);
}
