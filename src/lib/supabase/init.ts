/**
 * Supabase server helpers: profile initialization + health check.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { withTimeout } from "@/lib/reliability/retry";

type Db = SupabaseClient<Database>;

/** Upsert a profile row for a user (idempotent). */
export async function ensureProfile(
  sb: Db,
  userId: string,
  overrides: { fullName?: string; company?: string } = {}
): Promise<void> {
  const { error } = await sb.from("profiles").upsert(
    {
      id: userId,
      full_name: overrides.fullName ?? null,
      company: overrides.company ?? "Revuvia",
    },
    { onConflict: "id" }
  );
  if (error) {
    throw new Error(`Failed to initialize profile: ${error.message}`);
  }
}

export interface DbHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/** Round-trip health probe against the PostgREST API. */
export async function checkDbHealth(sb: Db, timeoutMs = 5_000): Promise<DbHealth> {
  const startedAt = Date.now();
  try {
    const { error } = await withTimeout(
      Promise.resolve(sb.from("profiles").select("id").limit(1).maybeSingle()),
      timeoutMs,
      "DB health probe timed out"
    );
    return { ok: !error, latencyMs: Date.now() - startedAt, error: error?.message };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
