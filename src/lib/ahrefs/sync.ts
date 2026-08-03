/**
 * Ahrefs sync — Sprint 6.
 *
 * DI orchestration: pulls backlinks for a target domain (paginated), upserts
 * them idempotently on `(owner_id, url_from, url_to)`, writes a sync log.
 * The server wrapper (`sync.ts`) injects Supabase storage.
 */

import type { AhrefsClient } from "@/lib/ahrefs/connector";
import type { AhrefsBacklinkRow } from "@/types/supabase";

export interface AhrefsStorage {
  upsertBacklinks(rows: Array<Pick<AhrefsBacklinkRow, "url_from" | "url_to" | "domain_from" | "domain_rating" | "anchor" | "first_seen" | "last_seen">>): Promise<number>;
  writeLog(entry: { target: string; status: "running" | "success" | "partial" | "failed"; rowsUpserted: number; error?: string }): Promise<void>;
}

export interface AhrefsLogger {
  info?(msg: string, fields?: Record<string, unknown>): void;
  warn?(msg: string, fields?: Record<string, unknown>): void;
  error?(msg: string, fields?: Record<string, unknown>): void;
}

export interface AhrefsSyncDeps {
  client: AhrefsClient;
  storage: AhrefsStorage;
  logger?: AhrefsLogger;
  /** Max pages to fetch per run (safety). */
  maxPages?: number;
  pageSize?: number;
}

export interface AhrefsSyncSummary {
  ok: boolean;
  reason: "not_configured" | "no_target" | "ok";
  target: string | null;
  upserted: number;
  total: number;
}

const NOOP_LOGGER: Required<AhrefsLogger> = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** Dereference a possibly-undefined method safely. */
function call<T extends (...args: never[]) => unknown>(fn: T | undefined, ...args: Parameters<T>): void {
  if (fn) fn(...args);
}

export async function syncAhrefs(deps: AhrefsSyncDeps): Promise<AhrefsSyncSummary> {
  const logger = deps.logger ?? NOOP_LOGGER;
  const maxPages = deps.maxPages ?? 5;
  const pageSize = deps.pageSize ?? 1000;

  const target = process.env.AHREFS_TARGET?.trim() || null;
  if (!process.env.AHREFS_API_TOKEN?.trim()) {
    call(logger.warn, "ahrefs.sync skipped", { reason: "not_configured" });
    return { ok: false, reason: "not_configured", target: null, upserted: 0, total: 0 };
  }
  if (!target) {
    call(logger.warn, "ahrefs.sync skipped", { reason: "no_target" });
    return { ok: false, reason: "no_target", target: null, upserted: 0, total: 0 };
  }

  let upserted = 0;
  let total = 0;
  let cursor: string | undefined;
  let pages = 0;
  let lastError: string | null = null;

  try {
    do {
      const page = await deps.client.fetchBacklinks(target, cursor, pageSize);
      total = page.total;
      if (page.rows.length > 0) {
        upserted += await deps.storage.upsertBacklinks(
          page.rows.map((r) => ({
            url_from: r.urlFrom,
            url_to: r.urlTo,
            domain_from: r.domainFrom,
            domain_rating: r.domainRating,
            anchor: r.anchor,
            first_seen: r.firstSeen,
            last_seen: r.lastSeen,
          }))
        );
      }
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor && pages < maxPages);

    call(logger.info, "ahrefs.sync complete", { target, pages, upserted, total });
    await deps.storage.writeLog({ target, status: "success", rowsUpserted: upserted });
    return { ok: true, reason: "ok", target, upserted, total };
  } catch (err) {
    lastError = String(err);
    call(logger.error, "ahrefs.sync failed", { target, error: lastError });
    await deps.storage.writeLog({
      target,
      status: "failed",
      rowsUpserted: upserted,
      error: lastError,
    });
    return { ok: false, reason: "ok", target, upserted, total };
  }
}
