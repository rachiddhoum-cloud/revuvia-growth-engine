import { describe, expect, it } from "vitest";

import type { ProspectRow } from "@/types/supabase";
import {
  FOLLOW_UP_CADENCE_DAYS,
  benefitsFor,
  buildFollowUps,
  buildFirstTouchEmail,
  buildOutreachKit,
  detectedProblems,
} from "@/lib/sales/outreach";

const base: ProspectRow = {
  id: "p1",
  owner_id: "owner",
  company: "Le Petit Bistro",
  industry: "restaurant",
  contact_name: "Marie",
  email: "marie@bistro.fr",
  priority_score: 10,
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
  country: "FR",
  city: "Lyon",
  language: "fr",
  company_size: 5,
  est_monthly_reviews: 3,
  est_seo_score: 15,
  est_traffic: 300,
  est_opportunity_score: null,
  lead_score: null,
  lead_temperature: null,
  acv_usd: 480,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("detectedProblems", () => {
  it("detects weak reviews, weak SEO and missing channels", () => {
    const problems = detectedProblems(base);
    expect(problems.some((p) => p.includes("reviews"))).toBe(true);
    expect(problems.some((p) => p.includes("invisible"))).toBe(true);
    expect(problems.some((p) => p.includes("website"))).toBe(true);
  });

  it("stays positive for healthy businesses", () => {
    const healthy: ProspectRow = {
      ...base,
      website: "https://bistro.fr",
      google_maps_url: "https://maps.google.com/?cid=1",
      est_monthly_reviews: 300,
      est_seo_score: 90,
      est_traffic: 20000,
    };
    const problems = detectedProblems(healthy);
    expect(problems).toHaveLength(1);
    expect(problems[0]).not.toContain("only");
  });
});

describe("benefitsFor", () => {
  it("maps industries to benefits", () => {
    expect(benefitsFor("restaurant")[0]).toContain("reviews");
    expect(benefitsFor("salon")[0]).toContain("appointment");
    expect(benefitsFor("dentist")[0]).toContain("bookings");
  });

  it("falls back to generic benefits", () => {
    expect(benefitsFor(null)[0]).toContain("review");
    expect(benefitsFor("plumber")).toEqual(benefitsFor("generic"));
  });
});

describe("buildFirstTouchEmail", () => {
  it("personalizes company, contact and problems", () => {
    const email = buildFirstTouchEmail(base);
    expect(email.channel).toBe("email");
    expect(email.body).toContain("Marie");
    expect(email.body).toContain("Le Petit Bistro");
    expect(email.subject).toContain("Le Petit Bistro");
    expect(email.templateKey).toBe("first_touch_email");
  });

  it("never leaves placeholder tokens", () => {
    const email = buildFirstTouchEmail(base);
    expect(email.body).not.toMatch(/\{[^}]+\}/);
    expect(email.subject).not.toMatch(/\{[^}]+\}/);
  });
});

describe("buildFollowUps", () => {
  it("escalates across channels with an ascending cadence", () => {
    const followUps = buildFollowUps(base);
    expect(followUps).toHaveLength(3);
    expect(followUps.map((f) => f.channel)).toEqual(["linkedin", "whatsapp", "call"]);
    expect(followUps.map((f) => f.delayDays)).toEqual(FOLLOW_UP_CADENCE_DAYS);
    expect(followUps.every((f) => f.escalation === true)).toBe(true);
  });

  it("personalizes every follow-up and keeps scripts token-free", () => {
    const followUps = buildFollowUps(base);
    for (const f of followUps) {
      expect(f.body).toContain("Marie");
      expect(f.body).not.toMatch(/\{[^}]+\}/);
    }
    expect(followUps[2].body).toContain("90 seconds");
  });
});

describe("buildOutreachKit", () => {
  it("assembles the full kit", () => {
    const kit = buildOutreachKit(base);
    expect(kit.prospectId).toBe("p1");
    expect(kit.company).toBe("Le Petit Bistro");
    expect(kit.problems.length).toBeGreaterThan(0);
    expect(kit.benefits.length).toBeGreaterThan(0);
    expect(kit.firstTouch.channel).toBe("email");
    expect(kit.followUps).toHaveLength(3);
  });
});
