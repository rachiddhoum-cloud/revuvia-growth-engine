/**
 * GSC sync orchestration — Sprint 5, Phase 3.
 *
 * Pure execution flow with dependency injection: storage, client and logger
 * are injected so the whole sync can be tested with in-memory stores and a
 * fake connector. The server wrapper (`sync.ts`) wires the real Supabase
 * client, token refresh and automation chain.
 *
 * Idempotency: the window resumes the day after the last successful sync and
 * every row is upserted on its natural key — re-running never duplicates.
 */

import type { GscClient, GscRow } from "@/lib/gsc/connector";
import {
  aggregateDailyRows,
  chunkRows,
  eachDate,
  mapPageRows,
  mapQueryRows,
  planSyncWindow,
  type DailyRow,
  type PageRow,
  type QueryRow,
} from "@/lib/gsc/core";

export interface SyncCredentials {
  siteUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface SyncStorage {
  loadLastSyncedAt(): Promise<string | null>;
  upsertSite(siteUrl: string): Promise<void>;
  upsertQueries(rows: QueryRow[]): Promise<number>;
  upsertPages(rows: PageRow[]): Promise<number>;
  upsertDaily(rows: DailyRow[]): Promise<number>;
  writeLog(entry: {
    siteUrl: string;
    status: "success" | "partial" | "failed";
    rowsUpserted: number;
    window: string;
    error?: string;
  }): Promise<void>;
}

export interface SyncLogger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export interface SyncSummary {
  ok: boolean;
  reason?: "not_connected" | "error";
  window: { startDate: string; endDate: string; initial: boolean };
  upserted: { queries: number; pages: number; daily: number };
  logId?: string;
}

export interface SyncDeps {
  credentials: SyncCredentials | null;
  client: GscClient;
  storage: SyncStorage;
  logger?: SyncLogger;
}

const NOOP_LOGGER: SyncLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

async function fetchAllPages(
  client: GscClient,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: ["query"] | ["page"],
  logger: SyncLogger
): Promise<GscRow[]> {
  const all: GscRow[] = [];
  let startRow = 0;
  for (let page = 0; page < 20; page++) {
    const rows = await client.searchAnalytics({
      siteUrl,
      startDate,
      endDate,
      dimensions,
      rowLimit: 1000,
      startRow,
    });
    all.push(...rows);
    if (rows.length < 1000) break;
    startRow += 1000;
  }
  logger.info("gsc.fetch", { dimensions: dimensions[0], rows: all.length });
  return all;
}

/** Execute one full incremental sync. `today` is injectable for tests. */
export async function syncGscData(deps: SyncDeps, today: string): Promise<SyncSummary> {
  const logger = deps.logger ?? NOOP_LOGGER;

  if (!deps.credentials) {
    logger.warn("gsc.sync skipped", { reason: "not_connected" });
    return {
      ok: false,
      reason: "not_connected",
      window: { startDate: today, endDate: today, initial: false },
      upserted: { queries: 0, pages: 0, daily: 0 },
    };
  }

  const { siteUrl } = deps.credentials;
  const lastSyncedAt = await deps.storage.loadLastSyncedAt();
  const window = planSyncWindow(lastSyncedAt, today);
  logger.info("gsc.sync start", { siteUrl, window });

  try {
    await deps.storage.upsertSite(siteUrl);

    const queryRowsAll = await fetchAllPages(deps.client, siteUrl, window.startDate, window.endDate, ["query"], logger);
    const pageRowsAll = await fetchAllPages(deps.client, siteUrl, window.startDate, window.endDate, ["page"], logger);
    const dateRows = await deps.client.searchAnalytics({
      siteUrl,
      startDate: window.startDate,
      endDate: window.endDate,
      dimensions: ["date"],
      rowLimit: 1000,
    });

    // Normalize per day (queries and pages include their date dimension via
    // the row date; the API date dimension rows carry `date` in keys[0]).
    const queryRows: QueryRow[] = [];
    const pageRows: PageRow[] = [];
    const dailyRows: DailyRow[] = [];

    const dateKeys = new Set(dateRows.map((r) => r.keys[0]));
    for (const date of eachDate(window.startDate, window.endDate)) {
      const q = mapQueryRows(queryRowsAll, date);
      const p = mapPageRows(pageRowsAll, date);
      queryRows.push(...q);
      pageRows.push(...p);
      if (dateKeys.has(date)) {
        const daily = dateRows.find((r) => r.keys[0] === date);
        if (daily) {
          dailyRows.push({
            date,
            search_type: "web",
            clicks: daily.clicks,
            impressions: daily.impressions,
            ctr: daily.ctr,
            position: daily.position,
            pages: new Set(p.map((x) => x.url)).size,
            queries: new Set(q.map((x) => x.query)).size,
          });
        }
      } else {
        dailyRows.push(...aggregateDailyRows(q, p).rows);
      }
    }

    let upsertedQueries = 0;
    let upsertedPages = 0;
    let upsertedDaily = 0;
    for (const chunk of chunkRows(queryRows)) upsertedQueries += await deps.storage.upsertQueries(chunk);
    for (const chunk of chunkRows(pageRows)) upsertedPages += await deps.storage.upsertPages(chunk);
    for (const chunk of chunkRows(dailyRows)) upsertedDaily += await deps.storage.upsertDaily(chunk);

    const total = upsertedQueries + upsertedPages + upsertedDaily;
    await deps.storage.writeLog({
      siteUrl,
      status: "success",
      rowsUpserted: total,
      window: `${window.startDate}..${window.endDate}`,
    });
    logger.info("gsc.sync done", { total, upserted: { upsertedQueries, upsertedPages, upsertedDaily } });

    return {
      ok: true,
      window,
      upserted: { queries: upsertedQueries, pages: upsertedPages, daily: upsertedDaily },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("gsc.sync failed", { siteUrl, error: message });
    await deps.storage.writeLog({
      siteUrl,
      status: "failed",
      rowsUpserted: 0,
      window: `${window.startDate}..${window.endDate}`,
      error: message,
    });
    return { ok: false, reason: "error", window, upserted: { queries: 0, pages: 0, daily: 0 } };
  }
}
