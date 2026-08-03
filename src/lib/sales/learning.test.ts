import { describe, expect, it } from "vitest";

import type { ProspectRow } from "@/types/supabase";
import {
  detectCadencePatterns,
  detectChannelPatterns,
  detectIndustryPatterns,
  detectMessagePatterns,
  detectSalesPatterns,
} from "@/lib/sales/learning";
import type { MessageRecord } from "@/lib/sales/types";

const base: ProspectRow = {
  id: "p1",
  owner_id: "owner",
  company: "Bistro",
  industry: "restaurant",
  contact_name: null,
  email: null,
  priority_score: 0,
  status: "won",
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

const msg = (prospectId: string, channel: MessageRecord["channel"], templateKey: string, status: MessageRecord["status"] = "sent"): MessageRecord => ({
  prospectId,
  channel,
  templateKey,
  status,
  sentAt: status === "sent" || status === "replied" ? "2026-01-05T00:00:00Z" : null,
  repliedAt: status === "replied" ? "2026-01-06T00:00:00Z" : null,
});

describe("detectMessagePatterns", () => {
  it("finds templates that outperform the baseline", () => {
    const messages = [
      msg("a", "email", "template_a", "replied"),
      msg("b", "email", "template_a", "replied"),
      msg("c", "email", "template_a", "sent"),
      msg("d", "email", "template_b", "sent"),
      msg("e", "email", "template_b", "sent"),
    ];
    const patterns = detectMessagePatterns(messages);
    const a = patterns.find((p) => p.key === "template_a");
    expect(a).toBeTruthy();
    expect(a?.upliftPct).toBeGreaterThan(0);
    expect(a?.outcome).toBe("success");
    expect(a?.attempts).toBe(3);
    const b = patterns.find((p) => p.key === "template_b");
    expect(b?.upliftPct).toBeLessThan(0);
  });

  it("skips groups with too few samples", () => {
    const messages = [msg("a", "email", "solo", "replied")];
    expect(detectMessagePatterns(messages)).toHaveLength(0);
  });
});

describe("detectChannelPatterns", () => {
  it("measures reply uplift per channel", () => {
    const messages = [
      msg("a", "linkedin", "t", "replied"),
      msg("b", "linkedin", "t", "replied"),
      msg("c", "email", "t", "sent"),
      msg("d", "email", "t", "sent"),
      msg("e", "email", "t", "sent"),
    ];
    const patterns = detectChannelPatterns(messages);
    const linkedin = patterns.find((p) => p.key === "linkedin");
    expect(linkedin?.upliftPct).toBeGreaterThan(0);
    expect(linkedin?.successRate).toBe(1);
    const email = patterns.find((p) => p.key === "email");
    expect(email?.upliftPct).toBeLessThan(0);
  });
});

describe("detectIndustryPatterns", () => {
  it("finds industries that close above the baseline", () => {
    const prospects: ProspectRow[] = [
      { ...base, industry: "salon", status: "won" },
      { ...base, id: "b", industry: "salon", status: "won" },
      { ...base, id: "c", industry: "salon", status: "lost" },
      { ...base, id: "d", industry: "cafe", status: "lost" },
      { ...base, id: "e", industry: "cafe", status: "lost" },
    ];
    const patterns = detectIndustryPatterns(prospects);
    const salon = patterns.find((p) => p.key === "salon");
    expect(salon?.upliftPct).toBeGreaterThan(0);
    expect(salon?.outcome).toBe("success");
  });

  it("ignores prospects that are not closed", () => {
    const prospects: ProspectRow[] = [{ ...base, status: "interested" }];
    expect(detectIndustryPatterns(prospects)).toHaveLength(0);
  });
});

describe("detectCadencePatterns", () => {
  it("measures win uplift per touch count", () => {
    const prospects: ProspectRow[] = [
      { ...base, id: "a", status: "won" },
      { ...base, id: "b", status: "won" },
      { ...base, id: "c", status: "lost" },
      { ...base, id: "d", status: "lost" },
    ];
    const messages = [
      msg("a", "email", "t"),
      msg("a", "linkedin", "t"),
      msg("b", "email", "t"),
      msg("b", "linkedin", "t"),
      msg("c", "email", "t"),
      msg("d", "email", "t"),
    ];
    const patterns = detectCadencePatterns(prospects, messages);
    const twoTouches = patterns.find((p) => p.key === "2 touches");
    expect(twoTouches).toBeTruthy();
    expect(twoTouches?.successRate).toBe(1);
    expect(twoTouches?.upliftPct).toBeGreaterThan(0);
  });
});

describe("detectSalesPatterns", () => {
  it("aggregates all strategy observations", () => {
    const prospects: ProspectRow[] = [
      { ...base, status: "won", industry: "salon" },
      { ...base, id: "b", status: "lost", industry: "salon" },
    ];
    const messages = [
      msg("a", "email", "t1", "replied"),
      msg("b", "email", "t1", "replied"),
      msg("c", "linkedin", "t2", "sent"),
      msg("d", "linkedin", "t2", "sent"),
      msg("e", "linkedin", "t2", "sent"),
    ];
    const patterns = detectSalesPatterns(prospects, messages);
    const strategyTypes = new Set(patterns.map((p) => p.strategyType));
    expect(strategyTypes.has("sales_message")).toBe(true);
    expect(strategyTypes.has("sales_channel")).toBe(true);
    expect(strategyTypes.has("sales_industry")).toBe(true);
    expect(strategyTypes.has("sales_cadence")).toBe(true);
  });
});
