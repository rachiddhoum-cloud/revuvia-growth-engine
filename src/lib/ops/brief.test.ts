import { describe, expect, it } from "vitest";

import {
  briefToMarkdown,
  buildDailyBrief,
  newOpportunities,
  todaysPriorities,
  urgentIssues,
} from "@/lib/ops/brief";
import type { ActionPlan, GrowthSnapshot } from "@/lib/ops";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";

const snapshot: GrowthSnapshot = buildGrowthSnapshot({
  weekStart: "2026-07-27",
  weekEnd: "2026-08-02",
  daily: [
    { metric_date: "2026-08-01", organic_visits: 300, clicks: 30, impressions: 900, conversions: 3, lead_downloads: 5, revenue: 20 },
  ],
  pages: [],
  content: [{ id: "1", title: "Guide", status: "published", quality_score: 82, created_at: "2026-07-30" }],
  runs: [{ module: "content", status: "success", cost_usd: 2.5, created_at: "2026-08-01" }],
  customers: [
    { id: "c1", owner_id: "o", email: "a@b.c", company: "X", industry: null, status: "paid", plan: null, mrr_usd: 49, last_contact_at: null, created_at: "2026-07-01T00:00:00Z" },
    { id: "c2", owner_id: "o", email: "d@e.f", company: "Y", industry: null, status: "trial", plan: null, mrr_usd: 0, last_contact_at: null, created_at: "2026-07-02T00:00:00Z" },
    { id: "c3", owner_id: "o", email: "g@h.i", company: "Z", industry: null, status: "churned", plan: null, mrr_usd: 0, last_contact_at: null, created_at: "2026-06-01T00:00:00Z" },
  ],
  prospects: [],
  keywords: [],
});

const plan: ActionPlan = {
  weekStart: "2026-07-27",
  weekEnd: "2026-08-02",
  generatedAt: "2026-08-02T09:00:00Z",
  revenueForecastUsd: 120,
  actions: [
    { id: "a1", kind: "content", title: "Publish QR guide", description: "", priority: "P0", impact: 9, ease: 8, confidence: 0.8, ice: 500, mrrImpactUsd: 40, source: "x" },
    { id: "a2", kind: "sales", title: "Contact Cafe Luna", description: "", priority: "P1", impact: 6, ease: 9, confidence: 0.6, ice: 300, mrrImpactUsd: 30, source: "x" },
    { id: "a3", kind: "seo", title: "Refresh FAQ", description: "", priority: "P2", impact: 4, ease: 6, confidence: 0.7, ice: 180, mrrImpactUsd: 10, source: "x" },
  ],
};

describe("todaysPriorities", () => {
  it("returns only P0/P1 actions", () => {
    const priorities = todaysPriorities(plan);
    expect(priorities).toEqual(["Publish QR guide", "Contact Cafe Luna"]);
  });
});

describe("newOpportunities", () => {
  it("surfaces easy content and confident sales actions", () => {
    const opportunities = newOpportunities(plan, snapshot);
    expect(opportunities.some((o) => o.includes("QR guide"))).toBe(true);
  });
});

describe("urgentIssues", () => {
  it("flags churn, AI spend and low quality", () => {
    const issues = urgentIssues(snapshot);
    expect(issues.some((i) => i.includes("churned"))).toBe(true);
    expect(issues.some((i) => i.includes("AI spend"))).toBe(true);
  });

  it("returns a calm default when nothing is urgent", () => {
    const calm = buildGrowthSnapshot({
      weekStart: "2026-07-27",
      weekEnd: "2026-08-02",
      daily: [],
      pages: [],
      content: [],
      runs: [],
      customers: [],
      prospects: [],
      keywords: [],
    });
    expect(urgentIssues(calm)).toEqual(["No urgent issues — keep executing."]);
  });
});

describe("buildDailyBrief", () => {
  const brief = buildDailyBrief({ snapshot, actionPlan: plan, now: new Date("2026-08-02T09:00:00Z") });

  it("assembles all four KPI lines", () => {
    expect(brief.marketingKpi).toContain("published");
    expect(brief.salesKpi).toContain("trials");
    expect(brief.trafficKpi).toContain("visits");
    expect(brief.revenueKpi).toContain("MRR");
  });

  it("targets a 3-minute read", () => {
    expect(brief.readMinutes).toBe(3);
  });

  it("renders markdown with all sections", () => {
    const md = briefToMarkdown(brief);
    expect(md).toContain("# Daily Brief");
    expect(md).toContain("## Today's priorities");
    expect(md).toContain("## New opportunities");
    expect(md).toContain("## Urgent issues");
    expect(md).toContain("## KPIs");
  });
});
