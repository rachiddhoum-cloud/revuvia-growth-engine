import { describe, expect, it } from "vitest";

import { classifyIntent, detectSerpFeatures, estimateDifficulty, opportunityScore, rankOpportunities } from "@/lib/seo/scoring";

describe("classifyIntent", () => {
  it("detects transactional keywords", () => {
    expect(classifyIntent("acheter abonnement revuvia")).toBe("transactional");
  });

  it("detects commercial keywords", () => {
    expect(classifyIntent("meilleur outil avis clients")).toBe("commercial");
  });

  it("detects informational keywords", () => {
    expect(classifyIntent("comment rédiger une réponse")).toBe("informational");
  });

  it("falls back to navigational", () => {
    expect(classifyIntent("revuvia")).toBe("navigational");
  });
});

describe("estimateDifficulty", () => {
  it("returns a value clamped to 0-100", () => {
    const difficulty = estimateDifficulty({ keyword: "meilleur logiciel avis" });
    expect(difficulty).toBeGreaterThanOrEqual(0);
    expect(difficulty).toBeLessThanOrEqual(100);
  });

  it("uses the live SERP signal when provided", () => {
    expect(estimateDifficulty({ keyword: "x", baseSignal: 87 })).toBe(87);
  });
});

describe("opportunityScore", () => {
  it("favors high volume, low difficulty, commercial intent", () => {
    const great = opportunityScore({ keyword: "best tool", volume: 8000, difficulty: 20, intent: "commercial" });
    const poor = opportunityScore({ keyword: "revuvia", volume: 10, difficulty: 90, intent: "navigational" });
    expect(great).toBeGreaterThan(poor);
    expect(great).toBeLessThanOrEqual(100);
  });
});

describe("rankOpportunities", () => {
  it("sorts by opportunity score descending and assigns priorities", () => {
    const ranked = rankOpportunities([
      { opportunity_score: 40 },
      { opportunity_score: 90 },
      { opportunity_score: 60 },
    ]);
    expect(ranked.map((r) => r.priority)).toEqual([1, 2, 3]);
    expect(ranked.map((r) => r.item.opportunity_score)).toEqual([90, 60, 40]);
  });
});

describe("detectSerpFeatures", () => {
  it("detects a featured snippet for how-to queries", () => {
    expect(detectSerpFeatures("comment obtenir des avis")).toContain("featured_snippet");
  });

  it("detects a local pack for near-me queries", () => {
    expect(detectSerpFeatures("restaurant à proximité")).toContain("local_pack");
  });
});
