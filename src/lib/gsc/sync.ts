/**
 * GSC server sync — Sprint 5, Phase 3 + 10.
 *
 * Server-only wrapper: loads credentials, refreshes the access token when
 * needed, wires the real Supabase storage into `syncGscData`, then runs the
 * automation chain (backfill daily_metrics → weekly loop → CEO report →
 * founder inbox). Idempotent and retry-safe: re-running never duplicates.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase";
import { logger } from "@/lib/log/logger";
import { createGscClient, refreshAccessToken, type GscCredentials } from "@/lib/gsc/connector";
import { syncGscData, type SyncSummary } from "@/lib/gsc/sync-core";
import type { SyncStorage } from "@/lib/gsc/sync-core";
import { todayLocal } from "@/lib/ops/publishing";
import { toLocalIso } from "@/lib/gsc/core";

type StoredCredentials = GscCredentials & { lastSyncedAt: string | null };

async function loadCredentials(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string
): Promise<StoredCredentials | null> {
  const { data, error } = await sb
    .from("search_console_credentials")
    .select("site_url,access_token,refresh_token,expires_at,last_synced_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn("gsc.credentials load failed", { error: error.message });
    return null;
  }
  if (!data) return null;
  return {
    siteUrl: data.site_url,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_at,
    lastSyncedAt: data.last_synced_at,
  };
}

async function ensureFreshToken(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  credentials: StoredCredentials
): Promise<StoredCredentials> {
  if (new Date(credentials.expiresAt).getTime() > Date.now()) return credentials;

  const clientId = process.env.GSC_CLIENT_ID ?? "";
  const clientSecret = process.env.GSC_CLIENT_SECRET ?? "";
  if (!clientId || !clientSecret) {
    throw new Error("GSC_CLIENT_ID / GSC_CLIENT_SECRET are not configured");
  }

  const fresh = await refreshAccessToken(credentials.refreshToken, clientId, clientSecret);
  const { error } = await sb
    .from("search_console_credentials")
    .update({ access_token: fresh.accessToken, expires_at: fresh.expiresAt })
    .eq("owner_id", ownerId)
    .eq("site_url", credentials.siteUrl);
  if (error) throw new Error(`Failed to persist refreshed token: ${error.message}`);

  logger.info("gsc.token refreshed");
  return { ...credentials, accessToken: fresh.accessToken, expiresAt: fresh.expiresAt };
}

function buildStorage(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string
): SyncStorage {
  return {
    async loadLastSyncedAt() {
      const { data } = await sb
        .from("search_console_credentials")
        .select("last_synced_at")
        .eq("owner_id", ownerId)
        .limit(1)
        .maybeSingle();
      return data?.last_synced_at ?? null;
    },

    async upsertSite(siteUrl) {
      const { error } = await sb.from("search_console_sites").upsert(
        { owner_id: ownerId, site_url: siteUrl, name: siteUrl.replace(/^sc-domain:/, "") },
        { onConflict: "owner_id,site_url" }
      );
      if (error) throw new Error(`Failed to upsert site: ${error.message}`);
    },

    async upsertQueries(rows) {
      if (rows.length === 0) return 0;
      const { error } = await sb.from("search_console_queries").upsert(
        rows.map((r) => ({ owner_id: ownerId, ...r })),
        { onConflict: "owner_id,site_url,query,search_type,date" }
      );
      if (error) throw new Error(`Failed to upsert queries: ${error.message}`);
      return rows.length;
    },

    async upsertPages(rows) {
      if (rows.length === 0) return 0;
      const { error } = await sb.from("search_console_pages").upsert(
        rows.map((r) => ({ owner_id: ownerId, ...r })),
        { onConflict: "owner_id,site_url,url,search_type,date" }
      );
      if (error) throw new Error(`Failed to upsert pages: ${error.message}`);
      return rows.length;
    },

    async upsertDaily(rows) {
      if (rows.length === 0) return 0;
      const { error } = await sb.from("search_console_daily_metrics").upsert(
        rows.map((r) => ({ owner_id: ownerId, ...r })),
        { onConflict: "owner_id,site_url,date,search_type" }
      );
      if (error) throw new Error(`Failed to upsert daily: ${error.message}`);
      return rows.length;
    },

    async writeLog(entry) {
      const { error } = await sb.from("search_console_sync_logs").insert({
        owner_id: ownerId,
        site_url: entry.siteUrl,
        status: entry.status,
        rows_upserted: entry.rowsUpserted,
        sync_window: entry.window,
        error: entry.error ?? null,
        finished_at: new Date().toISOString(),
      });
      if (error) logger.warn("gsc.log write failed", { error: error.message });
    },
  };
}

/**
 * Backfill `daily_metrics` (the analytics source of truth) from GSC daily
 * rows for the last 7 days. Conversions/revenue columns are left untouched.
 */
async function backfillDailyMetrics(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string
): Promise<number> {
  const { data, error } = await sb
    .from("search_console_daily_metrics")
    .select("date,clicks,impressions,ctr,position")
    .eq("owner_id", ownerId)
    .gte("date", toLocalIso(new Date(Date.now() - 6 * 86_400_000)));
  if (error) throw new Error(`Failed to read GSC daily: ${error.message}`);

  let upserted = 0;
  for (const row of data ?? []) {
    const { error: upErr } = await sb.from("daily_metrics").upsert(
      {
        owner_id: ownerId,
        metric_date: row.date,
        organic_visits: row.clicks,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
      },
      { onConflict: "owner_id,metric_date" }
    );
    if (upErr) throw new Error(`Failed to backfill daily_metrics: ${upErr.message}`);
    upserted++;
  }
  return upserted;
}

/** Full GSC sync + automation chain (cron `/api/gsc/sync`). */
export async function runGscSync(ownerId = "system"): Promise<{
  sync: SyncSummary;
  automation: { backfilled: number; loops: string[] };
}> {
  const sb = createServiceRoleClient();
  const raw = await loadCredentials(sb, ownerId);
  const credentials = raw ? await ensureFreshToken(sb, ownerId, raw) : null;

  const storage = buildStorage(sb, ownerId);
  const summary = await syncGscData(
    {
      credentials,
      client: createGscClient(
        credentials ?? { accessToken: "", refreshToken: "", expiresAt: new Date(0).toISOString(), siteUrl: "" },
        { minIntervalMs: 150 }
      ),
      storage,
      logger,
    },
    todayLocal()
  );

  if (!summary.ok) {
    return { sync: summary, automation: { backfilled: 0, loops: [] } };
  }

  // P10 — automation: analytics → score/opportunities/calendar → CEO report → inbox.
  const loops: string[] = [];
  const backfilled = await backfillDailyMetrics(sb, ownerId);
  loops.push("backfill_daily_metrics");

  const { executeWeeklyLoop, runFounderInbox } = await import("@/lib/ops/execute");
  const { generateOpsArtifact } = await import("@/lib/ops/generate");

  const results = await Promise.allSettled([
    executeWeeklyLoop(ownerId),
    generateOpsArtifact("ceo_report", ownerId),
    runFounderInbox(ownerId),
  ]);
  const labels = ["weekly_loop", "ceo_report", "founder_inbox"];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      loops.push(labels[i]);
    } else {
      logger.error("gsc.automation step failed", { step: labels[i], error: String(r.reason) });
    }
  });

  if (credentials) {
    const { error: touchError } = await sb
      .from("search_console_credentials")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("owner_id", ownerId)
      .eq("site_url", credentials.siteUrl);
    if (touchError) logger.warn("gsc.last_synced_at update failed", { error: touchError.message });
  }

  return { sync: summary, automation: { backfilled, loops } };
}
