import { describe, expect, it } from "vitest";

import { syncAhrefs, type AhrefsStorage, type AhrefsSyncDeps } from "@/lib/ahrefs/sync";

function storageStub(): AhrefsStorage & { upsertedRows: unknown[][]; logs: unknown[] } {
  const stub = {
    upsertedRows: [] as unknown[][],
    logs: [] as unknown[],
    async upsertBacklinks(rows: unknown[]) {
      stub.upsertedRows.push(rows);
      return rows.length;
    },
    async writeLog(entry: unknown) {
      stub.logs.push(entry);
    },
  };
  return stub;
}

function deps(storage: AhrefsStorage): AhrefsSyncDeps {
  return {
    client: {
      async fetchBacklinks(_target, cursor) {
        if (cursor === "c2") {
          return { rows: [], total: 3, nextCursor: null };
        }
        return {
          rows: [
            { urlFrom: "https://a.com/1", urlTo: "https://target.com/", domainFrom: "a.com", domainRating: 30, anchor: "x", firstSeen: null, lastSeen: null },
            { urlFrom: "https://a.com/2", urlTo: "https://target.com/", domainFrom: "a.com", domainRating: 30, anchor: "y", firstSeen: null, lastSeen: null },
          ],
          total: 3,
          nextCursor: cursor ? null : "c2",
        };
      },
    },
    storage,
  };
}

describe("syncAhrefs", () => {
  it("skips when not configured", async () => {
    delete process.env.AHREFS_API_TOKEN;
    delete process.env.AHREFS_TARGET;
    const storage = storageStub();
    const result = await syncAhrefs(deps(storage));
    expect(result.reason).toBe("not_configured");
  });

  it("syncs pages idempotently and logs success", async () => {
    process.env.AHREFS_API_TOKEN = "tok";
    process.env.AHREFS_TARGET = "target.com";
    const storage = storageStub();
    const result = await syncAhrefs(deps(storage));

    expect(result.ok).toBe(true);
    expect(result.upserted).toBe(2);
    expect(result.total).toBe(3);
    expect(storage.upsertedRows).toHaveLength(1);
    expect(storage.upsertedRows[0]).toHaveLength(2);
    expect(storage.logs.at(-1)).toMatchObject({ status: "success", rowsUpserted: 2 });
  });

  it("logs a failure with the error", async () => {
    process.env.AHREFS_API_TOKEN = "tok";
    process.env.AHREFS_TARGET = "target.com";
    const storage = storageStub();
    const failing: AhrefsSyncDeps = {
      ...deps(storage),
      client: {
        async fetchBacklinks() {
          throw new Error("boom");
        },
      },
    };
    const result = await syncAhrefs(failing);
    expect(result.ok).toBe(false);
    expect(storage.logs.at(-1)).toMatchObject({ status: "failed" });
  });
});
