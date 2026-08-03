import { describe, expect, it } from "vitest";

import type { CustomerRow, ProspectRow } from "@/types/supabase";
import { buildSalesAnalytics, contactedCount, replyCount } from "@/lib/sales/analytics";
import type { MessageRecord } from "@/lib/sales/types";

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

const customer = (mrr: number): CustomerRow => ({
  id: "c1",
  owner_id: "owner",
  email: "a@b.fr",
  company: "Paid Co",
  industry: "salon",
  status: "paid",
  plan: "pro",
  mrr_usd: mrr,
  last_contact_at: null,
  created_at: "2026-01-01T00:00:00Z",
});

const message = (prospectId: string, status: MessageRecord["status"]): MessageRecord => ({
  prospectId,
  channel: "email",
  templateKey: "first_touch_email",
  status,
  sentAt: status === "sent" || status === "replied" ? "2026-01-02T00:00:00Z" : null,
  repliedAt: status === "replied" ? "2026-01-03T00:00:00Z" : null,
});

describe("replyCount / contactedCount", () => {
  it("counts distinct prospects that replied", () => {
    const prospects = [
      { ...base, id: "a" },
      { ...base, id: "b" },
      { ...base, id: "c" },
    ];
    const messages = [message("a", "replied"), message("a", "sent"), message("b", "sent")];
    expect(replyCount(prospects, messages)).toBe(1);
    expect(contactedCount(prospects, messages)).toBe(2);
  });

  it("counts stages beyond contacted as contacted even without messages", () => {
    const prospects: ProspectRow[] = [
      { ...base, id: "a", status: "negotiation" },
      { ...base, id: "b", status: "new_lead" },
    ];
    expect(contactedCount(prospects, [])).toBe(1);
  });
});

describe("buildSalesAnalytics", () => {
  it("computes funnel, revenue, reply rate and forecast", () => {
    const analytics = buildSalesAnalytics({
      prospects: [
        { ...base, id: "a", status: "interested", acv_usd: 1000 },
        { ...base, id: "b", status: "negotiation", acv_usd: 2000 },
        { ...base, id: "c", status: "won", acv_usd: 500 },
        { ...base, id: "d", status: "lost" },
      ],
      customers: [customer(400), customer(200)],
      messages: [message("a", "replied"), message("b", "sent"), message("b", "sent")],
      events: [],
      asOf: new Date("2026-01-10T00:00:00Z"),
    });

    expect(analytics.paidCustomers).toBe(2);
    expect(analytics.mrrUsd).toBe(600);
    expect(analytics.revenueUsd).toBe(7200);
    expect(analytics.replyRate).toBeCloseTo(0.5);
    expect(analytics.meetings).toBe(1); // negotiation (demo_scheduled+)
    expect(analytics.trials).toBe(0);
    expect(analytics.winRate).toBe(0.5);
    expect(analytics.forecast.next30DaysUsd).toBeGreaterThan(0);
    expect(analytics.forecast.next90DaysUsd).toBe(analytics.forecast.next30DaysUsd * 3);
  });

  it("returns zeros for an empty pipeline", () => {
    const analytics = buildSalesAnalytics({
      prospects: [],
      customers: [],
      messages: [],
      events: [],
      asOf: new Date("2026-01-10T00:00:00Z"),
    });
    expect(analytics.mrrUsd).toBe(0);
    expect(analytics.replyRate).toBe(0);
    expect(analytics.forecast.next30DaysUsd).toBe(0);
  });
});
