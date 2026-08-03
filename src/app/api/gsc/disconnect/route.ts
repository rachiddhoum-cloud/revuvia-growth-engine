import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/log/logger";
import { resolveOwnerId } from "@/lib/owner";

interface DisconnectBody {
  ownerId?: unknown;
}

/** POST /api/gsc/disconnect — removes credentials and GSC data for an owner. */
export const POST = withRouteHandler<DisconnectBody>(
  async (body) => {
    const ownerId = resolveOwnerId(typeof body?.ownerId === "string" ? body.ownerId : null);
    const sb = createServiceRoleClient();

    const cronHeader = process.env.CRON_SECRET;
    // Cron callers may still use x-cron-secret; UI calls are rate-limited only.

    const tables = [
      "search_console_credentials",
      "search_console_sites",
      "search_console_queries",
      "search_console_pages",
      "search_console_daily_metrics",
      "search_console_sync_logs",
    ] as const;

    for (const table of tables) {
      const { error } = await sb.from(table).delete().eq("owner_id", ownerId);
      if (error) {
        logger.warn("gsc.disconnect delete failed", { table, error: error.message });
        throw ApiError.serviceUnavailable(`Failed to clear ${table}`);
      }
    }

    logger.info("gsc.disconnect complete", { ownerId, viaCron: Boolean(cronHeader) });
    return NextResponse.json({ ok: true });
  },
  { rateLimit: { limiter: aiRateLimiter, keyPrefix: "gsc-disconnect" } }
);
