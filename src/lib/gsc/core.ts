/**
 * GSC sync core — Sprint 5, Phase 3.
 *
 * Pure, deterministic sync helpers: incremental window planning, GSC row
 * mapping into normalized Supabase rows, and daily aggregation. The server
 * wrapper (`sync.ts`) injects the real storage; tests inject in-memory
 * stores (dependency injection, no duplicated logic).
 */

import type { GscRequest, GscRow } from "@/lib/gsc/connector";

export const INITIAL_SYNC_DAYS = 28;
export const MAX_ROWS_PER_PAGE = 1000;

export function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add `offset` days to a yyyy-mm-dd local date. */
export function addDays(date: string, offset: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offset);
  return toLocalIso(dt);
}

export interface SyncWindow {
  startDate: string;
  endDate: string;
  initial: boolean;
}

/**
 * Incremental window: resume the day after the last successful sync (only
 * dates already persisted are skipped — never duplicated). First sync
 * fetches `INITIAL_SYNC_DAYS` days. `today` is injectable for tests.
 */
export function planSyncWindow(lastSyncedAt: string | null, today: string): SyncWindow {
  if (!lastSyncedAt) {
    return { startDate: addDays(today, -(INITIAL_SYNC_DAYS - 1)), endDate: today, initial: true };
  }
  const resume = addDays(lastSyncedAt.slice(0, 10), 1);
  if (resume > today) {
    return { startDate: today, endDate: today, initial: false };
  }
  return { startDate: resume, endDate: today, initial: false };
}

/** Every date in the window (inclusive). */
export function eachDate(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let d = startDate;
  let guard = 0;
  while (d <= endDate && guard < 400) {
    dates.push(d);
    d = addDays(d, 1);
    guard++;
  }
  return dates;
}

export interface QueryRow {
  query: string;
  search_type: string;
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PageRow {
  url: string;
  search_type: string;
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface DailyRow {
  date: string;
  search_type: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  pages: number;
  queries: number;
}

/** Map one GSC analytics row (dimensions: query) to a normalized query row. */
export function mapQueryRows(rows: GscRow[], date: string, searchType = "web"): QueryRow[] {
  return rows.map((r) => ({
    query: r.keys[0] ?? "",
    search_type: searchType,
    date,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

/** Map one GSC analytics row (dimensions: page) to a normalized page row. */
export function mapPageRows(rows: GscRow[], date: string, searchType = "web"): PageRow[] {
  return rows.map((r) => ({
    url: r.keys[0] ?? "",
    search_type: searchType,
    date,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }));
}

export interface DailyAggregate {
  rows: DailyRow[];
  clicks: number;
  impressions: number;
  queries: number;
  pages: number;
}

/**
 * Aggregate a day's query rows into one daily row (weighted CTR/position).
 * `queries` = distinct queries, `pages` = distinct URLs (provided when the
 * pages dimension was fetched separately).
 */
export function aggregateDailyRows(
  queryRows: QueryRow[],
  pageRows: PageRow[],
  searchType = "web"
): DailyAggregate {
  if (queryRows.length === 0 && pageRows.length === 0) {
    return { rows: [], clicks: 0, impressions: 0, queries: 0, pages: 0 };
  }

  const date = queryRows[0]?.date ?? pageRows[0]?.date ?? "";
  const clicks = queryRows.reduce((a, r) => a + r.clicks, 0);
  const impressions = queryRows.reduce((a, r) => a + r.impressions, 0);
  const weightedCtr = impressions > 0 ? queryRows.reduce((a, r) => a + r.ctr * r.impressions, 0) / impressions : 0;
  const weightedPosition =
    impressions > 0
      ? queryRows.reduce((a, r) => a + r.position * r.impressions, 0) / impressions
      : 0;
  const queries = new Set(queryRows.map((r) => r.query)).size;
  const pages = new Set(pageRows.map((r) => r.url)).size;

  const row: DailyRow = {
    date,
    search_type: searchType,
    clicks,
    impressions,
    ctr: Math.round(weightedCtr * 10000) / 10000,
    position: Math.round(weightedPosition * 100) / 100,
    pages,
    queries,
  };

  return { rows: [row], clicks, impressions, queries, pages };
}

export interface SyncPlan {
  window: SyncWindow;
  requests: GscRequest[];
}

/**
 * Build the full list of GSC requests for a sync: one per day for daily
 * metrics (dimensions: date), plus one range request for queries and one for
 * pages. Pagination (startRow) is handled by the executor.
 */
export function buildSyncRequests(siteUrl: string, window: SyncWindow): SyncPlan {
  const { startDate, endDate } = window;
  const base = { siteUrl, startDate, endDate };
  return {
    window,
    requests: [
      { ...base, dimensions: ["query"] },
      { ...base, dimensions: ["page"] },
      { ...base, dimensions: ["date"] },
    ],
  };
}

/** Split a large GSC row set into pages for upsert batches. */
export function chunkRows<T>(rows: T[], size = 500): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}
