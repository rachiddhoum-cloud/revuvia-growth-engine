import { describe, expect, it } from "vitest";

import { buildGrowthSnapshot } from "@/lib/ops/snapshot";
import {
  buildGrowthScore,
  contentDimension,
  conversionDimension,
  executionDimension,
  leadsDimension,
  revenueDimension,
  seoDimension,
  trafficDimension,
  WEIGHTS,
} from "@/lib/ops/growth-score";
import type { DailyMetricRow } from "@/lib/analytics/aggregate";
import type { CustomerRow } from "@/types/supabase";
import type { GrowthSnapshot } from "@/lib/ops/types";

const daily = (organic_visits: number, conversions = 0, lead_downloads = 0): DailyMetricRow[] => [
  {
    metric_date: "2026-08-05",
    organic_visits,
    clicks: Math.round(organic_visits * 0.03),
    impressions: organic_visits * 10,
    conversions,
    lead_downloads,
    revenue: 0,
  },
];

const customer = (overrides: Partial<CustomerRow>): CustomerRow => ({
  id: "c1",
  owner_id: "u",
  email: "a@b.c",
  company: null,
  industry: null,
  status: "paid",
  plan: "pro",
  mrr_usd: 0,
  last_contact_at: null,
  created_at: "2026-01-01",
  ...overrides,
});

type RawOverrides = Omit<Partial<GrowthSnapshot>, "customers"> & {
  customers?: CustomerRow[];
};

function makeSnapshot(overrides: RawOverrides = {}): GrowthSnapshot {
  const built = buildGrowthSnapshot({
    weekStart: "2026-08-03",
    weekEnd: "2026-08-09",
    daily: overrides.daily ?? [],
    pages: overrides.pages ?? [],
    content: overrides.content ?? [],
    runs: overrides.runs ?? [],
    customers: overrides.customers ?? [],
    prospects: overrides.prospects ?? [],
    keywords: overrides.keywords ?? [],
  });
  if (overrides.previous) {
    built.previous = overrides.previous;
  }
  return built;
}

describe("dimension scorers", () => {
  it("seo dimension reflects position health", () => {
    const good = makeSnapshot({
      pages: [{ url: "/a", visits: 10, clicks: 2, impressions: 50, ctr: 0.04, avg_position: 3 }],
    });
    const bad = makeSnapshot({
      pages: [{ url: "/a", visits: 10, clicks: 1, impressions: 50, ctr: 0.02, avg_position: 12 }],
    });
    expect(seoDimension(good)).toBeGreaterThan(seoDimension(bad));
    expect(seoDimension(good)).toBeLessThanOrEqual(100);
  });

  it("content dimension combines quality and velocity", () => {
    const rich = makeSnapshot({
      content: [
        { id: "1", title: "A", status: "published", quality_score: 90, created_at: "2026-08-01" },
        { id: "2", title: "B", status: "published", quality_score: 80, created_at: "2026-08-02" },
      ],
    });
    const poor = makeSnapshot({ content: [{ id: "1", title: "A", status: "published", quality_score: 30, created_at: "2026-08-01" }] });
    expect(contentDimension(rich)).toBeGreaterThan(contentDimension(poor));
  });

  it("traffic dimension grows with weekly growth", () => {
    const growing = makeSnapshot({ daily: daily(300) });
    growing.previous.visits = 100;
    const flat = makeSnapshot({ daily: daily(100) });
    flat.previous.visits = 100;
    expect(trafficDimension(growing)).toBeGreaterThan(trafficDimension(flat));
  });

  it("leads dimension scales with download rate", () => {
    const withLeads = makeSnapshot({ daily: daily(1000, 2, 40) });
    const none = makeSnapshot({ daily: daily(1000, 2, 0) });
    expect(leadsDimension(withLeads)).toBeGreaterThan(leadsDimension(none));
  });

  it("conversion dimension scales with signup rate", () => {
    const good = makeSnapshot({ daily: daily(1000, 50, 10) });
    const bad = makeSnapshot({ daily: daily(1000, 0, 10) });
    expect(conversionDimension(good)).toBeGreaterThan(conversionDimension(bad));
  });

  it("revenue dimension rewards MRR and penalizes churn", () => {
    const rich = makeSnapshot({ customers: [customer({ mrr_usd: 2000 })] });
    const churned = makeSnapshot({
      customers: [
        customer({ mrr_usd: 1000 }),
        customer({ id: "c2", email: "d@e.f", status: "churned", mrr_usd: 0 }),
        customer({ id: "c3", email: "g@h.i", status: "churned", mrr_usd: 0 }),
      ],
    });
    expect(revenueDimension(rich)).toBeGreaterThan(revenueDimension(churned));
  });

  it("execution dimension mirrors completion rate", () => {
    expect(executionDimension(1)).toBe(100);
    expect(executionDimension(0)).toBe(0);
    expect(executionDimension(0.5)).toBe(50);
  });
});

describe("buildGrowthScore", () => {
  it("produces a score within 0-100", () => {
    const score = buildGrowthScore({ snapshot: makeSnapshot({}) });
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });

  it("weights dimensions exactly", () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it("reports the trend versus previous total", () => {
    const up = buildGrowthScore({ snapshot: makeSnapshot({}), previousTotal: 0 });
    expect(up.trend).toBe("up");
    expect(up.previousTotal).toBe(0);
    const down = buildGrowthScore({ snapshot: makeSnapshot({}), previousTotal: 99 });
    expect(down.trend).toBe("down");
    const flat = buildGrowthScore({ snapshot: makeSnapshot({}), previousTotal: null });
    expect(flat.trend).toBe("flat");
  });

  it("uses the completion rate for the execution dimension", () => {
    const executing = buildGrowthScore({ snapshot: makeSnapshot({}), completionRate: 0.9 });
    const idle = buildGrowthScore({ snapshot: makeSnapshot({}), completionRate: 0.1 });
    expect(executing.total).toBeGreaterThan(idle.total);
  });

  it("is deterministic", () => {
    const a = buildGrowthScore({ snapshot: makeSnapshot({}) });
    const b = buildGrowthScore({ snapshot: makeSnapshot({}) });
    expect(a).toEqual(b);
  });
});
