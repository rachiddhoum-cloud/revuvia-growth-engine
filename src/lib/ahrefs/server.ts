/**
 * Ahrefs server sync — Sprint 6.
 *
 * Server-only wrapper: real Supabase storage, real client, then the DI
 * orchestrator. Reads env (AHREFS_API_TOKEN, AHREFS_TARGET).
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/log/logger";
import { createAhrefsClient } from "@/lib/ahrefs/connector";
import { syncAhrefs, type AhrefsSyncSummary } from "@/lib/ahrefs/sync";

export async function runAhrefsSync(ownerId = "system"): Promise<AhrefsSyncSummary> {
  const sb = createServiceRoleClient();
  const client = createAhrefsClient({ minIntervalMs: 250 });

  return syncAhrefs({
    client,
    logger,
    storage: {
      async upsertBacklinks(rows) {
        if (rows.length === 0) return 0;
        const { error } = await sb.from("ahrefs_backlinks").upsert(
          rows.map((r) => ({ owner_id: ownerId, ...r })),
          { onConflict: "owner_id,url_from,url_to" }
        );
        if (error) throw new Error(`Failed to upsert backlinks: ${error.message}`);
        return rows.length;
      },
      async writeLog(entry) {
        const { error } = await sb.from("ahrefs_sync_logs").insert({
          owner_id: ownerId,
          target: entry.target,
          status: entry.status,
          rows_upserted: entry.rowsUpserted,
          error: entry.error ?? null,
          finished_at: new Date().toISOString(),
        });
        if (error) logger.warn("ahrefs.log write failed", { error: error.message });
      },
    },
  });
}
