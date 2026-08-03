import { describe, expect, it } from "vitest";

import type { ProspectRow } from "@/types/supabase";
import {
  competitionScore,
  digitalPresenceScore,
  priorityQueue,
  revenuePotential,
  reviewsWeakness,
  scoreProspectLead,
  seoWeakness,
  temperatureOf,
  urgencyScore,
} from "@/lib/sales/scoring";

const base: ProspectRow = {
  id: "p1",
  owner_id: "owner",
  company: "Le Petit Bistro",
  industry: "restaurant",
  contact_name: null,
  email: null,
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

describe("digitalPresenceScore", () => {
  it("scores a full online presence at 100", () => {
    const p = {
      website: "https://petitbistro.fr",
      google_maps_url: "https://maps.google.com/?cid=1",
      facebook_url: "https://facebook.com/bistro",
      instagram_url: "https://instagram.com/bistro",
      linkedin_url: "https://linkedin.com/company/bistro",
    };
    const presence = digitalPresenceScore(p);
    expect(presence.score).toBe(100);
    expect(presence.owned).toHaveLength(5);
    expect(presence.missing).toHaveLength(0);
  });

  it("reports missing channels for a bare business", () => {
    const presence = digitalPresenceScore({ website: null, google_maps_url: null, facebook_url: null, instagram_url: null, linkedin_url: null });
    expect(presence.score).toBe(0);
    expect(presence.missing).toHaveLength(5);
  });

  it("weights website highest", () => {
    const presence = digitalPresenceScore({ website: "https://x.fr", google_maps_url: null, facebook_url: null, instagram_url: null, linkedin_url: null });
    expect(presence.score).toBe(30);
  });
});

describe("reviewsWeakness", () => {
  it("peaks when the review base is tiny", () => {
    expect(reviewsWeakness(0)).toBe(90);
    expect(reviewsWeakness(5)).toBe(90);
  });

  it("fades as reviews accumulate", () => {
    expect(reviewsWeakness(40)).toBe(30);
    expect(reviewsWeakness(200)).toBe(15);
  });

  it("treats unknown as mild weakness", () => {
    expect(reviewsWeakness(null)).toBe(60);
  });
});

describe("seoWeakness", () => {
  it("uses the SEO score when present", () => {
    expect(seoWeakness(10, 5000)).toBe(80);
    expect(seoWeakness(90, 5000)).toBe(20);
  });

  it("falls back to traffic when the SEO score is unknown", () => {
    expect(seoWeakness(null, 50)).toBe(70);
    expect(seoWeakness(null, 5000)).toBe(30);
  });

  it("is neutral when nothing is known", () => {
    expect(seoWeakness(null, null)).toBe(50);
  });
});

describe("revenuePotential", () => {
  it("scales with traffic and ACV", () => {
    expect(revenuePotential(1000, 480)).toBe(10);
    expect(revenuePotential(10000, 480)).toBe(96);
  });

  it("defaults the ACV for unknown values", () => {
    expect(revenuePotential(5000, null)).toBe(48);
  });

  it("returns 0 with no traffic", () => {
    expect(revenuePotential(null, 480)).toBe(0);
  });
});

describe("competitionScore", () => {
  it("rises with traffic size", () => {
    expect(competitionScore(100, null)).toBe(40);
    expect(competitionScore(5000, null)).toBe(80);
  });

  it("adds pressure for larger companies", () => {
    expect(competitionScore(100, 50)).toBe(50);
  });

  it("is low for unknown small businesses", () => {
    expect(competitionScore(null, null)).toBe(20);
  });
});

describe("urgencyScore", () => {
  it("is highest when reviews are missing and traffic exists", () => {
    const p = { ...base, est_monthly_reviews: 0, est_traffic: 800, est_seo_score: 10 };
    expect(urgencyScore(p)).toBeGreaterThanOrEqual(80);
  });

  it("drops when the business is healthy", () => {
    const p = { ...base, est_monthly_reviews: 200, est_traffic: 5000, est_seo_score: 85 };
    expect(urgencyScore(p)).toBeLessThanOrEqual(30);
  });
});

describe("temperatureOf", () => {
  it("buckets scores into hot / warm / cold", () => {
    expect(temperatureOf(85)).toBe("hot");
    expect(temperatureOf(55)).toBe("warm");
    expect(temperatureOf(20)).toBe("cold");
  });
});

describe("scoreProspectLead", () => {
  it("produces a full lead score for a weak business", () => {
    const p: ProspectRow = {
      ...base,
      status: "new_lead",
      est_monthly_reviews: 3,
      est_seo_score: 15,
      est_traffic: 300,
      acv_usd: 480,
    };
    const score = scoreProspectLead(p);
    expect(score.total).toBeGreaterThan(50);
    expect(score.temperature).toBe("hot");
    expect(score.ice).toBeGreaterThan(0);
    expect(score.probability).toBeGreaterThan(0);
    expect(score.probability).toBeLessThanOrEqual(0.95);
  });

  it("scores a healthy business low", () => {
    const p: ProspectRow = {
      ...base,
      status: "new_lead",
      website: "https://healthy.fr",
      google_maps_url: "https://maps.google.com/?cid=9",
      facebook_url: "https://facebook.com/h",
      instagram_url: "https://instagram.com/h",
      est_monthly_reviews: 300,
      est_seo_score: 90,
      est_traffic: 20000,
    };
    const score = scoreProspectLead(p);
    expect(score.total).toBeLessThan(50);
    expect(score.temperature).toBe("cold");
  });

  it("never drops below 0 or above 100", () => {
    const p: ProspectRow = { ...base, est_monthly_reviews: 500, est_seo_score: 100, est_traffic: 1000000 };
    const score = scoreProspectLead(p);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });
});

describe("priorityQueue", () => {
  it("ranks by ICE and skips won / lost / archived prospects", () => {
    const weak: ProspectRow = { ...base, id: "weak", est_monthly_reviews: 0, est_traffic: 500 };
    const healthy: ProspectRow = { ...base, id: "healthy", est_monthly_reviews: 400, est_seo_score: 95 };
    const won: ProspectRow = { ...base, id: "won", status: "won", est_monthly_reviews: 0 };
    const list = priorityQueue([healthy, won, weak], 20);

    expect(list.map((p) => p.id)).toEqual(["weak", "healthy"]);
    expect(list[0].score.ice).toBeGreaterThan(list[1].score.ice);
  });

  it("respects the limit", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ ...base, id: `p${i}`, est_traffic: i * 100 }));
    expect(priorityQueue(many, 5)).toHaveLength(5);
  });
});
