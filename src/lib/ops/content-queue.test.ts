import { describe, expect, it } from "vitest";

import {
  AI_COST_PER_1K_WORDS,
  buildContentQueue,
  defaultCandidates,
  estimateAiCost,
  rankContentQueue,
} from "@/lib/ops/content-queue";
import type { ContentCandidate, GrowthSnapshot } from "@/lib/ops";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";

const snapshot: GrowthSnapshot = buildGrowthSnapshot({
  weekStart: "2026-07-27",
  weekEnd: "2026-08-02",
  daily: [
    { metric_date: "2026-08-01", organic_visits: 120, clicks: 8, impressions: 300, conversions: 2, lead_downloads: 1, revenue: 0 },
  ],
  pages: [],
  content: [{ id: "1", title: "Google reviews", status: "published", quality_score: 88, created_at: "2026-07-28" }],
  runs: [],
  customers: [],
  prospects: [],
  keywords: ["google reviews", "qr codes", "review management"],
});

const candidates: ContentCandidate[] = [
  { id: "a", title: "Low potential", keyword: "x", kind: "article", trafficPotential: 3, businessValue: 3, difficulty: 3, revenueImpact: 2, estimatedWords: 1400 },
  { id: "b", title: "High potential", keyword: "y", kind: "article", trafficPotential: 9, businessValue: 9, difficulty: 8, revenueImpact: 9, estimatedWords: 1400 },
  { id: "c", title: "Mid", keyword: "z", kind: "lead_magnet", trafficPotential: 6, businessValue: 6, difficulty: 5, revenueImpact: 6, estimatedWords: 800 },
];

describe("estimateAiCost", () => {
  it("scales with word count", () => {
    expect(estimateAiCost({ estimatedWords: 1000 })).toBeCloseTo(AI_COST_PER_1K_WORDS, 5);
    expect(estimateAiCost({ estimatedWords: 500 })).toBeCloseTo(AI_COST_PER_1K_WORDS / 2, 5);
  });
});

describe("rankContentQueue", () => {
  it("sorts by ICE descending", () => {
    const queue = rankContentQueue(candidates, snapshot);
    expect(queue[0].id).toBe("b");
    expect(queue[2].id).toBe("a");
  });

  it("computes ice from traffic potential, confidence and ease", () => {
    const [top] = rankContentQueue(candidates, snapshot);
    expect(top.ice).toBeGreaterThan(0);
    expect(top.ice).toBeLessThanOrEqual(800);
  });
});

describe("defaultCandidates", () => {
  it("derives candidates from snapshot keywords", () => {
    const defaults = defaultCandidates(snapshot);
    expect(defaults.length).toBeGreaterThan(0);
    expect(defaults[0].keyword).toBe("google reviews");
    expect(defaults[0].kind).toBe("article");
  });
});

describe("buildContentQueue", () => {
  it("caps the queue and sums AI cost", () => {
    const { queue, totalAiCostUsd } = buildContentQueue(candidates, snapshot, 2);
    expect(queue).toHaveLength(2);
    expect(totalAiCostUsd).toBeGreaterThan(0);
  });
});
