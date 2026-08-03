import { describe, expect, it } from "vitest";

import {
  buildSeoMissions,
  findCompetitorGaps,
  findKeywordAttacks,
  findTrafficLosses,
  findUnderLinkedPages,
  quickWins,
} from "@/lib/ops/seo-missions";
import type { GrowthSnapshot } from "@/lib/ops";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";

const snapshot: GrowthSnapshot = buildGrowthSnapshot({
  weekStart: "2026-07-27",
  weekEnd: "2026-08-02",
  daily: [],
  pages: [
    { url: "/blog/a", visits: 150, clicks: 10, impressions: 400, ctr: 0.025, avg_position: 5 },
    { url: "/blog/b", visits: 0, clicks: 0, impressions: 0, ctr: null, avg_position: null },
  ],
  content: [
    { id: "1", title: "Existing guide", status: "published", quality_score: 90, created_at: "2026-07-01" },
  ],
  runs: [],
  customers: [],
  prospects: [],
  keywords: ["google reviews", "qr codes"],
});

describe("findTrafficLosses", () => {
  it("only targets pages with traffic", () => {
    const missions = findTrafficLosses(snapshot, 5);
    expect(missions.length).toBe(1);
    expect(missions[0].kind).toBe("traffic_loss");
    expect(missions[0].title).toContain("/blog/a");
  });
});

describe("findUnderLinkedPages", () => {
  it("suggests internal links for visited pages", () => {
    const missions = findUnderLinkedPages(snapshot, 5);
    expect(missions.length).toBe(1);
    expect(missions[0].kind).toBe("internal_links");
  });
});

describe("findKeywordAttacks", () => {
  it("skips keywords already covered by published content", () => {
    const missions = findKeywordAttacks(snapshot, 5);
    expect(missions.every((m) => !m.title.includes("Existing guide"))).toBe(true);
    expect(missions.length).toBe(2);
  });
});

describe("findCompetitorGaps", () => {
  it("creates competitor study missions", () => {
    const missions = findCompetitorGaps(["competitor.com"], 2);
    expect(missions[0].kind).toBe("competitor");
    expect(missions[0].detail).toContain("competitor.com");
  });
});

describe("buildSeoMissions", () => {
  it("combines all mission types and ranks by ICE", () => {
    const missions = buildSeoMissions({ ...snapshot, competitors: ["rival.io"] }, 10);
    expect(missions.length).toBeGreaterThan(0);
    for (let i = 1; i < missions.length; i++) {
      expect(missions[i - 1].ice).toBeGreaterThanOrEqual(missions[i].ice);
    }
    expect(new Set(missions.map((m) => m.kind)).size).toBeGreaterThan(1);
  });

  it("caps at the limit", () => {
    expect(buildSeoMissions(snapshot, 2)).toHaveLength(2);
  });
});

describe("quickWins", () => {
  it("only returns low-effort missions", () => {
    const wins = quickWins(buildSeoMissions(snapshot, 10));
    expect(wins.every((m) => m.ease >= 6)).toBe(true);
  });
});
