/**
 * GSC connection status for the Settings UI (server-only).
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";

export interface GscSiteSummary {
  siteUrl: string;
  name: string | null;
}

export interface GscSyncLogSummary {
  status: string;
  startedAt: string;
  finishedAt: string | null;
  rowsSynced: number | null;
  error: string | null;
}

export interface GscConnectionStatus {
  configured: boolean;
  connected: boolean;
  ownerId: string;
  siteUrl: string | null;
  sites: GscSiteSummary[];
  lastSyncedAt: string | null;
  tokenExpiresAt: string | null;
  latestSync: GscSyncLogSummary | null;
  queryCount: number;
  pageCount: number;
}

export function isGscEnvConfigured(): boolean {
  return Boolean(
    process.env.GSC_CLIENT_ID?.trim() &&
      process.env.GSC_CLIENT_SECRET?.trim() &&
      process.env.GSC_REDIRECT_URI?.trim()
  );
}

export async function loadGscConnectionStatus(ownerIdInput?: string): Promise<GscConnectionStatus> {
  const ownerId = resolveOwnerId(ownerIdInput);
  const configured = isGscEnvConfigured();

  const empty: GscConnectionStatus = {
    configured,
    connected: false,
    ownerId,
    siteUrl: null,
    sites: [],
    lastSyncedAt: null,
    tokenExpiresAt: null,
    latestSync: null,
    queryCount: 0,
    pageCount: 0,
  };

  if (!configured) return empty;

  try {
    const sb = createServiceRoleClient();

    const [credRes, sitesRes, logRes, queryCountRes, pageCountRes] = await Promise.all([
      sb
        .from("search_console_credentials")
        .select("site_url,last_synced_at,expires_at")
        .eq("owner_id", ownerId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("search_console_sites").select("site_url,name").eq("owner_id", ownerId),
      sb
        .from("search_console_sync_logs")
        .select("status,started_at,finished_at,rows_upserted,error")
        .eq("owner_id", ownerId)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("search_console_queries")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId),
      sb
        .from("search_console_pages")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", ownerId),
    ]);

    const cred = credRes.data;
    if (!cred) return empty;

    return {
      configured,
      connected: true,
      ownerId,
      siteUrl: cred.site_url,
      sites: (sitesRes.data ?? []).map((s) => ({
        siteUrl: s.site_url,
        name: s.name,
      })),
      lastSyncedAt: cred.last_synced_at,
      tokenExpiresAt: cred.expires_at,
      latestSync: logRes.data
        ? {
            status: logRes.data.status,
            startedAt: logRes.data.started_at,
            finishedAt: logRes.data.finished_at,
            rowsSynced: logRes.data.rows_upserted,
            error: logRes.data.error,
          }
        : null,
      queryCount: queryCountRes.count ?? 0,
      pageCount: pageCountRes.count ?? 0,
    };
  } catch {
    return empty;
  }
}
