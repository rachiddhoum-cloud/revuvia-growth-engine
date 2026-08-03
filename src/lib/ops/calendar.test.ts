import { describe, expect, it } from "vitest";

import { buildGrowthSnapshot } from "@/lib/ops/snapshot";
import { buildExecutionCalendar } from "@/lib/ops/calendar";
import { schedulePublishing } from "@/lib/ops/publishing";
import { buildSeoOptimizationPlan } from "@/lib/ops/seo-loop";
import { buildLeadGenerationPlan } from "@/lib/ops/lead-loop";
import { buildOpportunities } from "@/lib/ops/opportunities";
import type {
  ActionPlan,
  GrowthSnapshot,
  LeadGenerationPlan,
  OpportunityScan,
  PublishingPlan,
  SeoOptimizationPlan,
} from "@/lib/ops/types";

const snapshot: GrowthSnapshot = buildGrowthSnapshot({
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  daily: [],
  pages: [],
  content: [
    { id: "1", title: "SEO pour restaurants", status: "approved", quality_score: 85, created_at: "2026-07-01" },
  ],
  runs: [],
  customers: [
    {
      id: "c1",
      owner_id: "u",
      email: "a@b.c",
      company: null,
      industry: null,
      status: "paid",
      plan: "pro",
      mrr_usd: 100,
      last_contact_at: null,
      created_at: "2026-01-01",
    },
  ],
  prospects: [],
  keywords: ["SEO local"],
});

const actionPlan: ActionPlan = {
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  generatedAt: "2026-08-03",
  revenueForecastUsd: 400,
  actions: [
    {
      id: "a1",
      kind: "content",
      title: "Write SEO local guide",
      description: "x",
      priority: "P0",
      impact: 9,
      ease: 8,
      confidence: 0.8,
      ice: 576,
      mrrImpactUsd: 100,
      source: "content",
    },
  ],
};

const publishing: PublishingPlan = schedulePublishing(
  [{ id: "1", title: "SEO pour restaurants", slug: "seo-restaurants" }],
  { startDate: "2026-08-03" }
).plan;

const seoPlan: SeoOptimizationPlan = buildSeoOptimizationPlan({
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  pageTrends: [{ url: "/blog/a", previousVisits: 100, visits: 40 }],
  competitorSignals: [],
  targetKeywords: ["QR code"],
  coveredKeywords: [],
});

const leadPlan: LeadGenerationPlan = buildLeadGenerationPlan({ snapshot, topics: ["SEO local"] });
const opportunities: OpportunityScan = buildOpportunities({
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  month: 8,
  city: "Marrakech",
  topics: ["SEO local"],
  industries: ["restaurants"],
  trendingQueries: [{ query: "qr code menu", growthPct: 40 }],
  competitorWeaknesses: [],
});

const baseInput = {
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  actionPlan,
  publishingPlan: publishing,
  seoPlan,
  leadPlan,
  opportunities,
  estimatedSeoTraffic: 200,
  leadRate: 0.02,
};

describe("buildExecutionCalendar", () => {
  it("covers all three horizons", () => {
    const cal = buildExecutionCalendar(baseInput);
    const horizons = new Set(cal.tasks.map((t) => t.horizon));
    expect(horizons).toEqual(new Set(["daily", "weekly", "monthly"]));
  });

  it("every task carries priority, deadline, ROI, traffic, leads and MRR", () => {
    const cal = buildExecutionCalendar(baseInput);
    for (const t of cal.tasks) {
      expect(t.priority).toMatch(/^P[012]$/);
      expect(t.deadline).toBeTruthy();
      expect(t.roiUsd).toBeGreaterThanOrEqual(0);
      expect(t.estTraffic).toBeGreaterThanOrEqual(0);
      expect(t.estLeads).toBeGreaterThanOrEqual(0);
      expect(t.estMrrUsd).toBeGreaterThanOrEqual(0);
    }
  });

  it("includes publishing tasks with per-article traffic estimates", () => {
    const cal = buildExecutionCalendar(baseInput);
    const pub = cal.tasks.find((t) => t.source === "publishing");
    expect(pub).toBeDefined();
    expect(pub?.estTraffic).toBeGreaterThan(0);
  });

  it("sorts tasks by date then priority", () => {
    const cal = buildExecutionCalendar(baseInput);
    const dates = cal.tasks.map((t) => t.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("computes totals from all tasks", () => {
    const cal = buildExecutionCalendar(baseInput);
    const sum = (f: (t: (typeof cal.tasks)[number]) => number) =>
      cal.tasks.reduce((acc, t) => acc + f(t), 0);
    expect(cal.totals.traffic).toBe(sum((t) => t.estTraffic));
    expect(cal.totals.leads).toBe(sum((t) => t.estLeads));
    expect(cal.totals.mrrUsd).toBe(sum((t) => t.estMrrUsd));
  });

  it("is deterministic", () => {
    const a = buildExecutionCalendar(baseInput);
    const b = buildExecutionCalendar(baseInput);
    expect(a).toEqual(b);
  });

  it("adds link-building outreach tasks when an outreach plan is provided", () => {
    const cal = buildExecutionCalendar({
      ...baseInput,
      outreachPlan: {
        tasks: [
          {
            id: "outreach-0",
            pageUrl: "https://revuvia.app/blog/pricing-guide",
            pageTitle: "Pricing guide for SaaS",
            anchor: "pricing guide for saas",
            clicks: 120,
            impressions: 4200,
            ice: 231,
            priority: "P2",
            expectedTrafficGain: 84,
            reasoning: "x",
            emailDraft: "Hi,",
            prospectCompany: null,
          },
        ],
      },
    });
    const task = cal.tasks.find((t) => t.source === "link_building");
    expect(task).toBeDefined();
    expect(task?.title).toContain("Pricing guide for SaaS");
    expect(task?.estTraffic).toBe(84);
    expect(task?.deadline).toBe("2026-08-09");
  });

  it("ignores an empty outreach plan", () => {
    const cal = buildExecutionCalendar({ ...baseInput, outreachPlan: { tasks: [] } });
    expect(cal.tasks.some((t) => t.source === "link_building")).toBe(false);
  });
});
