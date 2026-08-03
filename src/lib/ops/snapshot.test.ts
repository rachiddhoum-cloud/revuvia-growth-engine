import { describe, expect, it } from "vitest";

import { estimateMrrImpact, iceScore, priorityFromIce } from "@/lib/ops/ice";
import { aggregateWeekly, buildGrowthSnapshot, estimateSeoTraffic, weekWindow } from "@/lib/ops/snapshot";
import type { SnapshotInput } from "@/lib/ops";

const base: SnapshotInput = {
  weekStart: "2026-07-27",
  weekEnd: "2026-08-02",
  daily: [
    { metric_date: "2026-07-28", organic_visits: 100, clicks: 10, impressions: 400, conversions: 2, lead_downloads: 1, revenue: 0 },
    { metric_date: "2026-07-29", organic_visits: 200, clicks: 20, impressions: 800, conversions: 4, lead_downloads: 3, revenue: 10 },
  ],
  pages: [],
  content: [
    { id: "1", title: "A", status: "published", quality_score: 92, created_at: "2026-07-28" },
    { id: "2", title: "B", status: "draft", quality_score: 60, created_at: "2026-07-27" },
  ],
  runs: [
    { module: "content", status: "success", cost_usd: 0.3, created_at: "2026-07-29" },
    { module: "social", status: "success", cost_usd: 0.2, created_at: "2026-07-29" },
  ],
  customers: [
    { id: "c1", owner_id: "o", email: "a@b.c", company: null, industry: null, status: "paid", plan: null, mrr_usd: 49, last_contact_at: null, created_at: "2026-07-01T00:00:00Z" },
    { id: "c2", owner_id: "o", email: "d@e.f", company: null, industry: null, status: "trial", plan: null, mrr_usd: 0, last_contact_at: null, created_at: "2026-07-02T00:00:00Z" },
  ],
  prospects: [],
  keywords: ["google reviews"],
};

describe("iceScore", () => {
  it("combines impact, confidence and ease", () => {
    expect(iceScore(10, 10, 10)).toBe(1000);
    expect(iceScore(5, 0.8 * 10, 7)).toBeGreaterThan(200);
    expect(iceScore(0, 5, 5)).toBe(0);
  });
});

describe("priorityFromIce", () => {
  it("buckets priorities", () => {
    expect(priorityFromIce(500)).toBe("P0");
    expect(priorityFromIce(300)).toBe("P1");
    expect(priorityFromIce(100)).toBe("P2");
  });
});

describe("estimateMrrImpact", () => {
  it("scales with visits, conversion and ACV", () => {
    expect(estimateMrrImpact(1000, 0.02, 49)).toBeGreaterThan(0);
    expect(estimateMrrImpact(0, 0.02, 49)).toBe(0);
  });
});

describe("aggregateWeekly", () => {
  it("sums metrics and counts published content", () => {
    const weekly = aggregateWeekly(base.daily, base.content.filter((c) => c.status === "published"), base.runs);
    expect(weekly.visits).toBe(300);
    expect(weekly.leads).toBe(4);
    expect(weekly.aiCostUsd).toBeCloseTo(0.5, 5);
    expect(weekly.publishedCount).toBe(1);
  });
});

describe("estimateSeoTraffic", () => {
  it("floors visits with the impression benchmark", () => {
    const est = estimateSeoTraffic(base.daily);
    expect(est).toBeGreaterThanOrEqual(300);
    expect(estimateSeoTraffic([])).toBe(0);
  });
});

describe("buildGrowthSnapshot", () => {
  it("computes conversion rate, MRR and quality average", () => {
    const snapshot = buildGrowthSnapshot(base);
    expect(snapshot.conversionRate).toBeCloseTo(6 / 300, 5);
    expect(snapshot.customers.mrrUsd).toBe(49);
    expect(snapshot.customers.paid).toBe(1);
    expect(snapshot.customers.trial).toBe(1);
    expect(snapshot.qualityAverage).toBe(76);
  });
});

describe("weekWindow", () => {
  it("returns the last 7 days inclusive", () => {
    const { start, end } = weekWindow(7, new Date(2026, 7, 2, 15));
    expect(start).toBe("2026-07-27");
    expect(end).toBe("2026-08-02");
  });
});
