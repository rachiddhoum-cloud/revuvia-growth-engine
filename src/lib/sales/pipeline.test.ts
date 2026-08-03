import { describe, expect, it } from "vitest";

import type { ProspectRow, ProspectStatus } from "@/types/supabase";
import {
  averageCycleDays,
  buildFunnel,
  canTransition,
  stageEvent,
  stageRank,
  transitionStage,
} from "@/lib/sales/pipeline";

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

describe("canTransition / transitionStage", () => {
  it("walks the happy path through the pipeline", () => {
    const path: ProspectStatus[] = ["new_lead", "contacted", "waiting", "interested", "demo_scheduled", "trial_started", "negotiation", "won"];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canTransition(path[i], path[i + 1])).toBe(true);
      expect(transitionStage(path[i], path[i + 1])).toBeNull();
    }
  });

  it("rejects illegal jumps and self transitions", () => {
    expect(canTransition("new_lead", "won")).toBe(false);
    expect(transitionStage("new_lead", "won")).toContain("cannot move");
    expect(transitionStage("new_lead", "new_lead")).toContain("already");
  });

  it("allows closing anywhere to lost / archived", () => {
    expect(canTransition("negotiation", "lost")).toBe(true);
    expect(canTransition("interested", "archived")).toBe(true);
    expect(canTransition("won", "archived")).toBe(true);
  });

  it("allows reopening a lost deal", () => {
    expect(canTransition("lost", "new_lead")).toBe(true);
  });
});

describe("stageEvent", () => {
  it("builds a history event", () => {
    const e = stageEvent("p1", "won", "signed", "2026-03-01T00:00:00Z");
    expect(e).toEqual({ prospectId: "p1", stage: "won", note: "signed", at: "2026-03-01T00:00:00Z" });
  });
});

describe("averageCycleDays", () => {
  it("measures days between first touch and win", () => {
    const events = [
      stageEvent("p1", "new_lead", null, "2026-01-01T00:00:00Z"),
      stageEvent("p1", "won", null, "2026-01-11T00:00:00Z"),
      stageEvent("p2", "new_lead", null, "2026-02-01T00:00:00Z"),
      stageEvent("p2", "won", null, "2026-02-11T00:00:00Z"),
    ];
    expect(averageCycleDays(events)).toBe(10);
  });

  it("returns 0 with no wins", () => {
    expect(averageCycleDays([stageEvent("p1", "new_lead", null, "2026-01-01T00:00:00Z")])).toBe(0);
  });
});

describe("buildFunnel", () => {
  it("computes totals, open value and win rate", () => {
    const prospects: ProspectRow[] = [
      { ...base, id: "a", status: "new_lead" },
      { ...base, id: "b", status: "interested", acv_usd: 1000 },
      { ...base, id: "c", status: "negotiation", acv_usd: 2000 },
      { ...base, id: "d", status: "won", acv_usd: 1000 },
      { ...base, id: "e", status: "lost" },
    ];
    const funnel = buildFunnel(prospects);
    expect(funnel.totals.new_lead).toBe(1);
    expect(funnel.totals.negotiation).toBe(1);
    expect(funnel.openDeals).toBe(3);
    expect(funnel.totalValueUsd).toBe(24 + 250 + 1200);
    expect(funnel.winRate).toBe(0.5);
  });

  it("excludes terminal stages from open deals", () => {
    const funnel = buildFunnel([
      { ...base, id: "a", status: "archived" },
      { ...base, id: "b", status: "won" },
    ]);
    expect(funnel.openDeals).toBe(0);
    expect(funnel.totalValueUsd).toBe(0);
  });
});

describe("stageRank", () => {
  it("orders canonical stages by pipeline position", () => {
    expect(stageRank("new_lead")).toBeLessThan(stageRank("won"));
    expect(stageRank("negotiation")).toBeLessThan(stageRank("won"));
  });
});
