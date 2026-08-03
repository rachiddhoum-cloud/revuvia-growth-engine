import { describe, expect, it, vi } from "vitest";

import { syncGscData } from "@/lib/gsc/sync-core";
import type { GscClient } from "@/lib/gsc/connector";
import type { SyncCredentials, SyncStorage } from "@/lib/gsc/sync-core";
import type { DailyRow, PageRow, QueryRow } from "@/lib/gsc/core";

const creds: SyncCredentials = {
  siteUrl: "sc-domain:example.com",
  accessToken: "tok",
  refreshToken: "rt",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

function fakeClient(): GscClient {
  return {
    async searchAnalytics(req) {
      const dims = req.dimensions ?? [];
      if (dims.includes("date")) {
        return [
          { clicks: 30, impressions: 1000, ctr: 0.03, position: 5, keys: ["2026-08-05"] },
          { clicks: 20, impressions: 800, ctr: 0.025, position: 6, keys: ["2026-08-06"] },
        ];
      }
      if (dims.includes("page")) {
        return [{ clicks: 25, impressions: 900, ctr: 0.027, position: 5, keys: ["/blog/seo"] }];
      }
      return [
        { clicks: 20, impressions: 700, ctr: 0.028, position: 5, keys: ["qr code menu"] },
        { clicks: 10, impressions: 300, ctr: 0.033, position: 6, keys: ["avis google"] },
      ];
    },
    async listSites() {
      return [];
    },
  };
}

function inMemoryStorage(initialLastSync: string | null = null): {
  storage: SyncStorage;
  queries: QueryRow[];
  pages: PageRow[];
  daily: DailyRow[];
  logs: { status: string; rowsUpserted: number; window?: string; error?: string }[];
} {
  const queries: QueryRow[] = [];
  const pages: PageRow[] = [];
  const daily: DailyRow[] = [];
  const logs: { status: string; rowsUpserted: number; window?: string; error?: string }[] = [];
  return {
    storage: {
      async loadLastSyncedAt() {
        return initialLastSync;
      },
      async upsertSite() {
        return undefined;
      },
      async upsertQueries(rows) {
        queries.push(...rows);
        return rows.length;
      },
      async upsertPages(rows) {
        pages.push(...rows);
        return rows.length;
      },
      async upsertDaily(rows) {
        daily.push(...rows);
        return rows.length;
      },
      async writeLog(entry) {
        logs.push(entry);
      },
    },
    queries,
    pages,
    daily,
    logs,
  };
}

describe("syncGscData", () => {
  it("skips cleanly when no account is connected", async () => {
    const mem = inMemoryStorage();
    const summary = await syncGscData(
      { credentials: null, client: fakeClient(), storage: mem.storage },
      "2026-08-09"
    );
    expect(summary.ok).toBe(false);
    expect(summary.reason).toBe("not_connected");
    expect(mem.logs.length).toBe(0);
  });

  it("performs a full 28-day initial sync and persists normalized rows", async () => {
    const mem = inMemoryStorage(null);
    const summary = await syncGscData(
      { credentials: creds, client: fakeClient(), storage: mem.storage },
      "2026-08-09"
    );
    expect(summary.ok).toBe(true);
    expect(summary.window.initial).toBe(true);
    expect(summary.window.startDate).toBe("2026-07-13");
    expect(summary.upserted.queries).toBe(56); // 2 queries x 28 days
    expect(summary.upserted.pages).toBe(28); // 1 page x 28 days
    expect(summary.upserted.daily).toBe(28);
    expect(mem.queries[0].query).toBe("qr code menu");
    expect(mem.queries[0].date).toBe("2026-07-13");
    expect(mem.pages[0].url).toBe("/blog/seo");
    expect(mem.daily[0].date).toBe("2026-07-13");
    expect(mem.logs[0].status).toBe("success");
  });

  it("runs an incremental window after the last sync (no duplicates)", async () => {
    const mem = inMemoryStorage("2026-08-05T08:00:00.000Z");
    const summary = await syncGscData(
      { credentials: creds, client: fakeClient(), storage: mem.storage },
      "2026-08-09"
    );
    expect(summary.window.initial).toBe(false);
    expect(summary.window.startDate).toBe("2026-08-06");
    expect(summary.upserted.queries).toBe(8); // 2 queries x 4 days
  });

  it("uses the API date rows when present for daily metrics", async () => {
    const mem = inMemoryStorage("2026-08-04T08:00:00.000Z");
    const summary = await syncGscData(
      { credentials: creds, client: fakeClient(), storage: mem.storage },
      "2026-08-09"
    );
    const aug5 = mem.daily.find((d) => d.date === "2026-08-05");
    expect(aug5?.clicks).toBe(30);
    expect(aug5?.impressions).toBe(1000);
    expect(aug5?.queries).toBe(2);
    expect(aug5?.pages).toBe(1);
    expect(summary.ok).toBe(true);
  });

  it("paginates when more than 1000 rows are returned", async () => {
    const calls: number[] = [];
    const client: GscClient = {
      async searchAnalytics(req) {
        const dims = req.dimensions ?? [];
        if (dims.includes("date") || dims.includes("page")) return [];
        calls.push(req.startRow ?? 0);
        if ((req.startRow ?? 0) === 0) {
          return Array.from({ length: 1000 }, (_, i) => ({
            clicks: 1,
            impressions: 10,
            ctr: 0.1,
            position: 3,
            keys: [`q${i}`],
          }));
        }
        return [{ clicks: 1, impressions: 10, ctr: 0.1, position: 3, keys: ["last"] }];
      },
      async listSites() {
        return [];
      },
    };
    const mem = inMemoryStorage(null);
    const summary = await syncGscData({ credentials: creds, client, storage: mem.storage }, "2026-08-09");
    expect(calls).toEqual([0, 1000]);
    expect(summary.upserted.queries).toBe(1001 * 28);
  });

  it("logs failures and returns a failed summary", async () => {
    const client: GscClient = {
      async searchAnalytics() {
        throw new Error("quota exceeded");
      },
      async listSites() {
        return [];
      },
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const mem = inMemoryStorage(null);
    const summary = await syncGscData(
      { credentials: creds, client, storage: mem.storage, logger },
      "2026-08-09"
    );
    expect(summary.ok).toBe(false);
    expect(summary.reason).toBe("error");
    expect(mem.logs[0].status).toBe("failed");
    expect(mem.logs[0].error).toBe("quota exceeded");
    expect(logger.error).toHaveBeenCalled();
  });
});
