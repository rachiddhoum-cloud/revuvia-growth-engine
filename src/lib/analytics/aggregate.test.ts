import { describe, expect, it } from "vitest";

import {
  buildAnalyticsModel,
  buildSeries,
  rankTopPages,
  statusDistribution,
  summarize,
} from "@/lib/analytics/aggregate";
import type { AnalyticsInput } from "@/lib/analytics/aggregate";

/** Fixed ISO dates so the test is timezone-independent. */
const FIXED_DAILY = [
  { metric_date: "2026-07-01", organic_visits: 120, clicks: 8, impressions: 200, conversions: 2, lead_downloads: 1, revenue: 0 },
  { metric_date: "2026-07-02", organic_visits: 90, clicks: 6, impressions: 150, conversions: 1, lead_downloads: 0, revenue: 50 },
];

const input: AnalyticsInput = {
  days: 30,
  daily: FIXED_DAILY,
  pages: [
    { url: "/blog/a", visits: 300, clicks: 20, impressions: 600, ctr: 0.03, avg_position: 4 },
    { url: "/blog/b", visits: 100, clicks: 5, impressions: 200, ctr: 0.02, avg_position: 7 },
    { url: "/blog/c", visits: 0, clicks: 0, impressions: 0, ctr: null, avg_position: null },
  ],
  content: [
    { id: "1", title: "A", status: "published", quality_score: 92, created_at: "2026-06-28" },
    { id: "2", title: "B", status: "published", quality_score: 84, created_at: "2026-06-29" },
    { id: "3", title: "C", status: "draft", quality_score: 55, created_at: "2026-06-30" },
  ],
  runs: [
    { module: "content", status: "success", cost_usd: 0.5, created_at: "2026-06-30" },
    { module: "content", status: "success", cost_usd: 0.4, created_at: "2026-07-01" },
    { module: "social", status: "success", cost_usd: 0.1, created_at: "2026-07-01" },
  ],
};

describe("buildSeries", () => {
  const end = new Date(2026, 6, 2); // 2026-07-02 local

  it("includes all provided days and fills gaps with zeros", () => {
    const series = buildSeries(FIXED_DAILY, 30, end);
    expect(series).toHaveLength(30);
    expect(series.some((p) => p.date === "2026-07-01" && p.visits === 120)).toBe(true);
    expect(series.some((p) => p.date === "2026-07-02" && p.visits === 90)).toBe(true);
  });

  it("keeps points ordered oldest → newest", () => {
    const series = buildSeries(FIXED_DAILY, 30, end);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].date > series[i - 1].date).toBe(true);
    }
  });

  it("uses ISO yyyy-mm-dd dates", () => {
    const series = buildSeries(FIXED_DAILY, 2, end);
    expect(series[1].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(series[1].label).toMatch(/^\d{2}-\d{2}$/);
  });
});

describe("summarize", () => {
  const s = summarize(input);

  it("counts published content", () => {
    expect(s.publishedCount).toBe(2);
  });

  it("sums metrics", () => {
    expect(s.totalVisits).toBe(210);
    expect(s.totalClicks).toBe(14);
    expect(s.totalImpressions).toBe(350);
    expect(s.totalConversions).toBe(3);
    expect(s.totalDownloads).toBe(1);
    expect(s.totalRevenue).toBe(50);
  });

  it("computes CTR from impressions/clicks", () => {
    expect(s.ctr).toBeCloseTo((14 / 350) * 100, 5);
  });

  it("averages quality scores", () => {
    expect(s.avgQualityScore).toBeCloseTo((92 + 84 + 55) / 3, 5);
  });

  it("aggregates AI runs and cost by module", () => {
    expect(s.aiRuns).toBe(3);
    expect(s.aiCostUsd).toBeCloseTo(1.0, 5);
    expect(s.modules[0]).toEqual({ module: "content", runs: 2 });
  });

  it("buckets quality scores", () => {
    const high = s.qualityBuckets.find((b) => b.label === "≥ 90");
    expect(high?.count).toBe(1);
  });
});

describe("rankTopPages", () => {
  it("sorts by visits and drops empty pages", () => {
    const pages = rankTopPages(input.pages, 5);
    expect(pages).toHaveLength(2);
    expect(pages[0].url).toBe("/blog/a");
    expect(pages[0].visits).toBe(300);
  });

  it("caps the result", () => {
    expect(rankTopPages(input.pages, 1)).toHaveLength(1);
  });
});

describe("statusDistribution", () => {
  it("orders published first", () => {
    const dist = statusDistribution(input.content);
    expect(dist[0]).toEqual({ status: "published", count: 2 });
    expect(dist[1]).toEqual({ status: "draft", count: 1 });
  });
});

describe("buildAnalyticsModel", () => {
  it("assembles the full model", () => {
    const model = buildAnalyticsModel(input);
    expect(model.series).toHaveLength(30);
    expect(model.summary.publishedCount).toBe(2);
    expect(model.topPages[0].url).toBe("/blog/a");
    expect(model.statusDistribution[0].status).toBe("published");
  });

  it("clamps days to 1..90", () => {
    expect(buildAnalyticsModel({ ...input, days: 500 }).series).toHaveLength(90);
    expect(buildAnalyticsModel({ ...input, days: 0 }).series).toHaveLength(1);
  });
});
