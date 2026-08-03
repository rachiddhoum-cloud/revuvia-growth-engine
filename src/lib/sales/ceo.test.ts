import { describe, expect, it } from "vitest";

import type { ProspectRow } from "@/types/supabase";
import { biggestRisks, buildCeoSalesReport, recentlyLost, topOpenDeals } from "@/lib/sales/ceo";

const base: ProspectRow = {
  id: "p1",
  owner_id: "owner",
  company: "Bistro",
  industry: "restaurant",
  contact_name: null,
  email: null,
  priority_score: 0,
  status: "new_lead",
  last_interaction_at: null,
  recommended_message: null,
  follow_up_at: null,
  probability: null,
  notes: null,
  website: null,
  google_maps_url: null,
  facebook_url: null,
  instagram_url: null,
  linkedin_url: null,
  phone: null,
  country: null,
  city: null,
  language: null,
  company_size: null,
  est_monthly_reviews: null,
  est_seo_score: null,
  est_traffic: null,
  est_opportunity_score: null,
  lead_score: null,
  lead_temperature: null,
  acv_usd: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const AS_OF = new Date("2026-03-01T00:00:00Z");

describe("topOpenDeals", () => {
  it("ranks open deals by expected value", () => {
    const deals = topOpenDeals(
      [
        { ...base, id: "a", company: "Small", status: "interested", acv_usd: 1000 },
        { ...base, id: "b", company: "Big", status: "negotiation", acv_usd: 5000 },
        { ...base, id: "c", company: "Won", status: "won", acv_usd: 9000 },
      ],
      2
    );
    expect(deals).toHaveLength(2);
    expect(deals[0].prospect.company).toBe("Big");
    expect(deals[0].valueUsd).toBeGreaterThan(deals[1].valueUsd);
  });
});

describe("recentlyLost", () => {
  it("finds prospects lost in the last 30 days", () => {
    const lost = recentlyLost(
      [
        { ...base, id: "a", status: "new_lead" },
        { ...base, id: "b", status: "lost", updated_at: "2026-02-20T00:00:00Z" },
      ],
      [],
      AS_OF
    );
    expect(lost.map((p) => p.id)).toEqual(["b"]);
  });
});

describe("biggestRisks", () => {
  it("flags overdue follow-ups and silent prospects", () => {
    const risks = biggestRisks(
      [
        { ...base, id: "a", company: "Stalled", status: "interested", follow_up_at: "2026-02-01T00:00:00Z" },
        { ...base, id: "b", company: "Cold", status: "replied", last_interaction_at: "2026-01-01T00:00:00Z" },
        { ...base, id: "c", company: "Fine", status: "negotiation", follow_up_at: "2026-02-28T00:00:00Z" },
      ],
      AS_OF
    );
    expect(risks.some((r) => r.includes("Stalled"))).toBe(true);
    expect(risks.some((r) => r.includes("silent"))).toBe(true);
    expect(risks.some((r) => r.includes("Fine"))).toBe(false);
  });
});

describe("buildCeoSalesReport", () => {
  it("builds the full one-page report with markdown", () => {
    const report = buildCeoSalesReport({
      analytics: {
        asOf: AS_OF.toISOString(),
        funnel: {
          totals: {} as never,
          openDeals: 1,
          totalValueUsd: 900,
          winRate: 0.5,
          averageCycleDays: 12,
        },
        contacted: 10,
        replies: 1,
        meetings: 2,
        trials: 0,
        paidCustomers: 3,
        revenueUsd: 14400,
        mrrUsd: 1200,
        replyRate: 0.1,
        winRate: 0.5,
        averageCycleDays: 12,
        forecast: { next30DaysUsd: 500, next90DaysUsd: 1500 },
      },
      prospects: [
        { ...base, id: "a", company: "Top Deal", status: "negotiation", acv_usd: 3000, lead_temperature: "hot" },
        { ...base, id: "b", company: "Silent", status: "interested", last_interaction_at: "2026-01-05T00:00:00Z", follow_up_at: "2026-02-01T00:00:00Z" },
      ],
      messages: [],
      events: [],
      asOf: AS_OF,
    });

    expect(report.topOpportunities[0].company).toBe("Top Deal");
    expect(report.topOpportunities[0].probability).toBeCloseTo(0.6);
    expect(report.highestValue).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.markdown).toContain("# CEO Sales Report");
    expect(report.markdown).toContain("$1200");
    expect(report.markdown).toContain("Top Deal");
  });
});
