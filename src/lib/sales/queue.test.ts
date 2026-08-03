import { describe, expect, it } from "vitest";

import type { ProspectRow } from "@/types/supabase";
import { buildDailyQueue, stageProbability } from "@/lib/sales/queue";

const base: ProspectRow = {
  id: "p1",
  owner_id: "owner",
  company: "Bistro",
  industry: "restaurant",
  contact_name: "Marie",
  email: "marie@bistro.fr",
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

describe("buildDailyQueue", () => {
  it("ranks weak prospects above healthy ones and caps the limit", () => {
    const weak: ProspectRow = { ...base, id: "weak", est_monthly_reviews: 0, est_seo_score: 15, est_traffic: 500 };
    const healthy: ProspectRow = { ...base, id: "healthy", est_monthly_reviews: 400, est_seo_score: 95 };
    const won: ProspectRow = { ...base, id: "won", status: "won" };

    const queue = buildDailyQueue({
      prospects: [healthy, won, weak],
      date: "2026-01-10",
      now: new Date("2026-01-10T00:00:00Z"),
      limit: 2,
    });

    expect(queue.items).toHaveLength(2);
    expect(queue.items.map((i) => i.prospectId)).toEqual(["weak", "healthy"]);
    expect(queue.items[0].rank).toBe(1);
    expect(queue.items[0].temperature).toBe("hot");
  });

  it("attaches the personalized first-touch message and expected revenue", () => {
    const p: ProspectRow = { ...base, acv_usd: 1000, est_traffic: 2000, est_monthly_reviews: 2 };
    const queue = buildDailyQueue({
      prospects: [p],
      date: "2026-01-10",
      now: new Date("2026-01-10T00:00:00Z"),
    });

    const item = queue.items[0];
    expect(item.message.channel).toBe("email");
    expect(item.message.body).toContain("Bistro");
    expect(item.expectedRevenueUsd).toBeGreaterThan(0);
    expect(item.expectedRevenueUsd).toBeLessThanOrEqual(1000);
    expect(item.effortMinutes).toBe(2);
    expect(item.followUpAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("totals the daily effort", () => {
    const queue = buildDailyQueue({
      prospects: [{ ...base, id: "a" }, { ...base, id: "b", est_traffic: 500 }],
      date: "2026-01-10",
      now: new Date("2026-01-10T00:00:00Z"),
      limit: 20,
    });
    expect(queue.totalEffortMinutes).toBe(4);
    expect(queue.date).toBe("2026-01-10");
  });

  it("boosts later pipeline stages above cold leads", () => {
    const coldHot: ProspectRow = { ...base, id: "cold", est_traffic: 0, est_monthly_reviews: 0 };
    const negotiation: ProspectRow = { ...base, id: "neg", status: "negotiation", est_traffic: 0, est_monthly_reviews: 0 };
    const queue = buildDailyQueue({
      prospects: [coldHot, negotiation],
      date: "2026-01-10",
      now: new Date("2026-01-10T00:00:00Z"),
      limit: 1,
    });
    expect(queue.items[0].prospectId).toBe("neg");
  });
});

describe("stageProbability", () => {
  it("maps stages to win probabilities", () => {
    expect(stageProbability("new_lead")).toBeCloseTo(0.05);
    expect(stageProbability("negotiation")).toBeCloseTo(0.6);
    expect(stageProbability("won")).toBe(1);
  });
});
