import { describe, expect, it } from "vitest";

import {
  buildSalesPlan,
  expectedProbability,
  followUpDate,
  industryMessage,
  scoreProspect,
} from "@/lib/ops/sales";
import type { ProspectRow } from "@/types/supabase";

const now = new Date("2026-08-02T09:00:00Z");

const prospects: ProspectRow[] = [
  {
    id: "p1",
    owner_id: "o",
    company: "Cafe Luna",
    industry: "cafe",
    contact_name: "Marie",
    email: "marie@cafeluna.fr",
    priority_score: 70,
    status: "replied",
    last_interaction_at: "2026-07-30T10:00:00Z",
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
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-30T10:00:00Z",
  },
  {
    id: "p2",
    owner_id: "o",
    company: "Salon Belle",
    industry: "salon",
    contact_name: null,
    email: null,
    priority_score: 30,
    status: "new",
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
    created_at: "2026-07-20T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
  },
  {
    id: "p3",
    owner_id: "o",
    company: "Lost One",
    industry: "restaurant",
    contact_name: null,
    email: null,
    priority_score: 10,
    status: "lost",
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
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  },
];

describe("industryMessage", () => {
  it("maps industries to tailored messages", () => {
    expect(industryMessage("cafe")).toContain("QR code");
    expect(industryMessage("salon")).toContain("5-star");
    expect(industryMessage("dentist")).toContain("clinics");
    expect(industryMessage(null)).toContain("walkthrough");
    expect(industryMessage("anything else")).toContain("Revuvia");
  });
});

describe("scoreProspect", () => {
  it("favours replied prospects with recent contact", () => {
    const replied = scoreProspect(prospects[0], now);
    const fresh = scoreProspect(prospects[1], now);
    expect(replied).toBeGreaterThan(fresh);
  });
});

describe("expectedProbability", () => {
  it("never exceeds 0.95 and grows with score", () => {
    expect(expectedProbability(prospects[0], 90)).toBeLessThanOrEqual(0.95);
    expect(expectedProbability(prospects[1], 40)).toBeGreaterThanOrEqual(0);
  });
});

describe("followUpDate", () => {
  it("schedules closed prospects immediately, others in the window", () => {
    expect(followUpDate("closed", now, 7)).toBe("2026-08-02");
    expect(followUpDate("new", now, 7)).toBe("2026-08-09");
  });
});

describe("buildSalesPlan", () => {
  it("excludes lost/closed and sorts by priority", () => {
    const plan = buildSalesPlan({ prospects, now, followUpDays: 7 });
    expect(plan.some((p) => p.company === "Lost One")).toBe(false);
    expect(plan[0].company).toBe("Cafe Luna");
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i - 1].priorityScore).toBeGreaterThanOrEqual(plan[i].priorityScore);
    }
  });

  it("fills recommended message from industry when missing", () => {
    const plan = buildSalesPlan({ prospects, now });
    const salon = plan.find((p) => p.company === "Salon Belle");
    expect(salon?.recommendedMessage).toContain("5-star");
  });

  it("caps results", () => {
    expect(buildSalesPlan({ prospects, now }, 1)).toHaveLength(1);
  });
});
