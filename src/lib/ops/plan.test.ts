import { describe, expect, it } from "vitest";

import { buildActionPlan, contentToAction, salesToAction, seoToAction } from "@/lib/ops/plan";
import type { ActionPlan, ContentIdea, GrowthSnapshot, SalesProspect, SeoMission } from "@/lib/ops";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";

const snapshot: GrowthSnapshot = buildGrowthSnapshot({
  weekStart: "2026-07-27",
  weekEnd: "2026-08-02",
  daily: [
    { metric_date: "2026-08-01", organic_visits: 200, clicks: 20, impressions: 600, conversions: 4, lead_downloads: 2, revenue: 10 },
  ],
  pages: [],
  content: [{ id: "1", title: "Guide", status: "published", quality_score: 85, created_at: "2026-07-29" }],
  runs: [],
  customers: [],
  prospects: [],
  keywords: [],
});

const contentQueue: ContentIdea[] = [
  { id: "c1", title: "QR codes guide", kind: "article", keyword: "qr codes", trafficPotential: 9, businessValue: 8, difficulty: 7, revenueImpact: 8, aiCostUsd: 0.03, ice: 500 },
  { id: "c2", title: "Review management", kind: "article", keyword: "reviews", trafficPotential: 6, businessValue: 7, difficulty: 6, revenueImpact: 6, aiCostUsd: 0.03, ice: 300 },
];

const seoMissions: SeoMission[] = [
  { id: "s1", kind: "internal_links", title: "Link /pricing", detail: "x", impact: 6, ease: 8, ice: 350 },
  { id: "s2", kind: "quick_win", title: "Refresh FAQ", detail: "x", impact: 4, ease: 6, ice: 200 },
];

const salesPlan: SalesProspect[] = [
  { id: "p1", company: "Cafe Luna", industry: "cafe", contactName: null, email: null, status: "replied", priorityScore: 80, lastInteractionAt: null, recommendedMessage: "m", followUpAt: "2026-08-09", probability: 0.6 },
  { id: "p2", company: "Salon Belle", industry: "salon", contactName: null, email: null, status: "new", priorityScore: 40, lastInteractionAt: null, recommendedMessage: "m", followUpAt: "2026-08-09", probability: 0.3 },
];

describe("contentToAction", () => {
  it("builds a P0 content action with ICE and MRR impact", () => {
    const action = contentToAction(contentQueue[0], snapshot);
    expect(action.kind).toBe("content");
    expect(action.priority).toBe("P0");
    expect(action.ice).toBe(500);
    expect(action.mrrImpactUsd).toBeGreaterThan(0);
  });
});

describe("seoToAction", () => {
  it("maps missions to actions", () => {
    const action = seoToAction(seoMissions[0]);
    expect(action.kind).toBe("seo");
    expect(action.title).toContain("/pricing");
    expect(action.source).toBe("seo-mission-center");
  });
});

describe("salesToAction", () => {
  it("creates contact actions weighted by probability", () => {
    const action = salesToAction(salesPlan[0]);
    expect(action.kind).toBe("sales");
    expect(action.title).toContain("Cafe Luna");
    expect(action.mrrImpactUsd).toBeGreaterThan(salesToAction(salesPlan[1]).mrrImpactUsd);
  });
});

describe("buildActionPlan", () => {
  const plan: ActionPlan = buildActionPlan({
    snapshot,
    contentQueue,
    seoMissions,
    salesPlan,
    avgContractValueUsd: 49,
    now: new Date("2026-08-02T09:00:00Z"),
  });

  it("returns top 10 actions sorted by ICE", () => {
    expect(plan.actions.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < plan.actions.length; i++) {
      expect(plan.actions[i - 1].ice).toBeGreaterThanOrEqual(plan.actions[i].ice);
    }
  });

  it("includes actions from all three command centers", () => {
    const kinds = new Set(plan.actions.map((a) => a.kind));
    expect(kinds).toContain("content");
    expect(kinds).toContain("seo");
    expect(kinds).toContain("sales");
  });

  it("exposes weekly window and revenue forecast", () => {
    expect(plan.weekStart).toBe("2026-07-27");
    expect(plan.revenueForecastUsd).toBeGreaterThan(0);
  });
});
