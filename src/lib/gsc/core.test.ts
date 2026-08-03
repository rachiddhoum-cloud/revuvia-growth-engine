import { describe, expect, it } from "vitest";

import {
  addDays,
  aggregateDailyRows,
  buildSyncRequests,
  chunkRows,
  eachDate,
  mapPageRows,
  mapQueryRows,
  planSyncWindow,
} from "@/lib/gsc/core";
import type { GscRow } from "@/lib/gsc/connector";

const row = (keys: string[], overrides: Partial<GscRow> = {}): GscRow => ({
  clicks: 5,
  impressions: 100,
  ctr: 0.05,
  position: 6,
  keys,
  ...overrides,
});

describe("planSyncWindow", () => {
  it("starts with 28 days on first sync", () => {
    const w = planSyncWindow(null, "2026-08-09");
    expect(w.initial).toBe(true);
    expect(w.startDate).toBe("2026-07-13");
    expect(w.endDate).toBe("2026-08-09");
  });

  it("resumes the day after the last sync", () => {
    const w = planSyncWindow("2026-08-05T08:00:00.000Z", "2026-08-09");
    expect(w.initial).toBe(false);
    expect(w.startDate).toBe("2026-08-06");
  });

  it("never duplicates an already-synced day", () => {
    const w = planSyncWindow("2026-08-09T08:00:00.000Z", "2026-08-09");
    expect(w.startDate).toBe("2026-08-09");
    expect(w.endDate).toBe("2026-08-09");
  });
});

describe("eachDate / addDays", () => {
  it("lists every date inclusive", () => {
    expect(eachDate("2026-08-01", "2026-08-03")).toEqual(["2026-08-01", "2026-08-02", "2026-08-03"]);
  });

  it("handles month boundaries", () => {
    expect(addDays("2026-08-30", 2)).toBe("2026-09-01");
  });
});

describe("mapQueryRows / mapPageRows", () => {
  it("maps rows with keys[0] and the given date", () => {
    const rows = mapQueryRows([row(["qr code menu"], { clicks: 4 })], "2026-08-09");
    expect(rows).toEqual([
      { query: "qr code menu", search_type: "web", date: "2026-08-09", clicks: 4, impressions: 100, ctr: 0.05, position: 6 },
    ]);
  });

  it("maps page rows with url keys", () => {
    const rows = mapPageRows([row(["/blog/seo"], { clicks: 2 })], "2026-08-09");
    expect(rows[0].url).toBe("/blog/seo");
  });

  it("falls back to empty string for missing keys", () => {
    expect(mapQueryRows([row([])], "2026-08-09")[0].query).toBe("");
  });
});

describe("aggregateDailyRows", () => {
  it("sums clicks and impressions, weights ctr and position", () => {
    const agg = aggregateDailyRows(
      [
        { query: "a", search_type: "web", date: "2026-08-09", clicks: 10, impressions: 100, ctr: 0.1, position: 2 },
        { query: "b", search_type: "web", date: "2026-08-09", clicks: 20, impressions: 300, ctr: 0.05, position: 8 },
      ],
      [{ url: "/x", search_type: "web", date: "2026-08-09", clicks: 5, impressions: 50, ctr: 0.1, position: 3 }]
    );
    expect(agg.clicks).toBe(30);
    expect(agg.impressions).toBe(400);
    expect(agg.rows[0].ctr).toBeCloseTo(0.0625, 4);
    expect(agg.rows[0].position).toBeCloseTo(6.5, 2);
    expect(agg.rows[0].queries).toBe(2);
    expect(agg.rows[0].pages).toBe(1);
  });

  it("returns zero-safe aggregates for empty input", () => {
    const agg = aggregateDailyRows([], []);
    expect(agg.rows).toEqual([{ date: "", search_type: "web", clicks: 0, impressions: 0, ctr: 0, position: 0, pages: 0, queries: 0 }]);
  });
});

describe("buildSyncRequests", () => {
  it("creates query, page and date requests for the window", () => {
    const plan = buildSyncRequests("sc-domain:example.com", { startDate: "2026-08-01", endDate: "2026-08-09", initial: false });
    expect(plan.requests.map((r) => r.dimensions)).toEqual([["query"], ["page"], ["date"]]);
    for (const r of plan.requests) {
      expect(r.siteUrl).toBe("sc-domain:example.com");
      expect(r.startDate).toBe("2026-08-01");
      expect(r.endDate).toBe("2026-08-09");
    }
  });
});

describe("chunkRows", () => {
  it("splits rows into batches", () => {
    const chunks = chunkRows([1, 2, 3, 4, 5], 2);
    expect(chunks).toEqual([[1, 2], [3, 4], [5]]);
  });
});
