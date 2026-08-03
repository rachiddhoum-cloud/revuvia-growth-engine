import { describe, expect, it } from "vitest";

import type { ProspectRow } from "@/types/supabase";
import { FOLLOW_UP_CADENCE_DAYS, followUpActions } from "@/lib/sales/followup";
import type { MessageRecord } from "@/lib/sales/types";

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

const NOW = new Date("2026-01-10T00:00:00Z");

const sent = (prospectId: string, daysAgo: number, channel: MessageRecord["channel"] = "email"): MessageRecord => ({
  prospectId,
  channel,
  templateKey: "first_touch_email",
  status: "sent",
  sentAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  repliedAt: null,
});

describe("followUpActions", () => {
  it("schedules first contact for never-touched leads", () => {
    const actions = followUpActions({
      prospects: [{ ...base, status: "new_lead" }],
      messages: [],
      now: new Date("2026-01-10T00:00:00Z"),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("first_contact");
    expect(actions[0].channel).toBe("email");
    expect(actions[0].message?.body).toContain("Bistro");
  });

  it("does not first-contact legacy statuses without a touch", () => {
    const actions = followUpActions({
      prospects: [{ ...base, status: "contacted" }],
      messages: [],
      now: new Date("2026-01-10T00:00:00Z"),
    });
    expect(actions).toHaveLength(0);
  });

  it("schedules the d+2 LinkedIn follow-up after the first touch", () => {
    const actions = followUpActions({
      prospects: [{ ...base, status: "new_lead" }],
      messages: [sent("p1", 3)],
      now: new Date("2026-01-10T00:00:00Z"),
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("follow_up");
    expect(actions[0].channel).toBe("linkedin");
    expect(actions[0].reason).toContain("day 2");
  });

  it("waits when the cadence has not elapsed yet", () => {
    const actions = followUpActions({
      prospects: [{ ...base, status: "new_lead" }],
      messages: [sent("p1", 1)],
      now: new Date("2026-01-10T00:00:00Z"),
    });
    expect(actions).toHaveLength(0);
  });

  it("stops when the prospect replied", () => {
    const actions = followUpActions({
      prospects: [{ ...base, status: "interested" }],
      messages: [{ ...sent("p1", 5), status: "replied", repliedAt: NOW.toISOString() }],
      now: NOW,
    });
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe("stop");
    expect(actions[0].reason).toContain("replied");
  });

  it("escalates to the phone after the last cadence step", () => {
    const messages = [
      sent("p1", 40, "email"),
      sent("p1", 36, "linkedin"),
      sent("p1", 30, "whatsapp"),
      sent("p1", 20, "call"),
    ];
    const actions = followUpActions({
      prospects: [{ ...base, status: "new_lead" }],
      messages,
      now: new Date("2026-01-10T00:00:00Z"),
    });
    const escalate = actions.find((a) => a.action === "escalate");
    expect(escalate).toBeTruthy();
    expect(escalate?.channel).toBe("call");
    expect(escalate?.reason).toContain("escalate");
  });

  it("stops after the max touch count", () => {
    const messages = Array.from({ length: 5 }, (_, i) => sent("p1", 60 - i * 3));
    const actions = followUpActions({
      prospects: [{ ...base, status: "new_lead" }],
      messages,
      now: new Date("2026-01-10T00:00:00Z"),
      maxTouches: 5,
    });
    expect(actions.some((a) => a.action === "stop" && a.reason.includes("5 touches"))).toBe(true);
  });

  it("skips terminal prospects entirely", () => {
    const actions = followUpActions({
      prospects: [
        { ...base, status: "won" },
        { ...base, id: "p2", status: "lost" },
      ],
      messages: [],
      now: new Date("2026-01-10T00:00:00Z"),
    });
    expect(actions).toHaveLength(0);
  });

  it("exposes the shared cadence", () => {
    expect(FOLLOW_UP_CADENCE_DAYS).toEqual([2, 5, 9]);
  });
});
