import { describe, expect, it } from "vitest";

import {
  buildSeoOptimizationPlan,
  findDecliningPages,
  keywordGaps,
  risingCompetitors,
} from "@/lib/ops/seo-loop";

const trends = [
  { url: "/blog/a", previousVisits: 200, visits: 120 },
  { url: "/blog/b", previousVisits: 200, visits: 190 },
  { url: "/blog/c", previousVisits: 0, visits: 10 },
  { url: "/blog/d", previousVisits: 100, visits: 0 },
];

describe("findDecliningPages", () => {
  it("detects pages with meaningful drops", () => {
    const declining = findDecliningPages(trends);
    expect(declining.map((p) => p.url)).toEqual(["/blog/d", "/blog/a"]);
  });

  it("ignores pages without previous traffic", () => {
    const declining = findDecliningPages(trends);
    expect(declining.some((p) => p.url === "/blog/c")).toBe(false);
  });

  it("respects the threshold", () => {
    const declining = findDecliningPages(trends, -50);
    expect(declining.map((p) => p.url)).toEqual(["/blog/d"]);
  });
});

describe("risingCompetitors", () => {
  it("keeps only competitors above the growth threshold", () => {
    const signals = [
      { name: "A", gainedKeywords: 12, growthPct: 30 },
      { name: "B", gainedKeywords: 5, growthPct: 8 },
      { name: "C", gainedKeywords: 20, growthPct: 45 },
    ];
    expect(risingCompetitors(signals).map((s) => s.name)).toEqual(["C", "A"]);
  });
});

describe("keywordGaps", () => {
  it("returns uncovered target keywords", () => {
    const gaps = keywordGaps(["SEO local", "QR code", "Avis Google"], ["SEO local", "avis google"]);
    expect(gaps).toEqual(["QR code"]);
  });

  it("deduplicates and trims", () => {
    const gaps = keywordGaps(["  X ", "X", "Y"], []);
    expect(gaps).toEqual(["X", "Y"]);
  });
});

describe("buildSeoOptimizationPlan", () => {
  it("creates tasks from every signal source", () => {
    const plan = buildSeoOptimizationPlan({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      pageTrends: trends,
      competitorSignals: [{ name: "BigCo", gainedKeywords: 8, growthPct: 25 }],
      targetKeywords: ["QR code"],
      coveredKeywords: [],
    });
    const sources = new Set(plan.tasks.map((t) => t.source));
    expect(sources.has("declining_page")).toBe(true);
    expect(sources.has("rising_competitor")).toBe(true);
    expect(sources.has("keyword_gap")).toBe(true);
  });

  it("ranks tasks by ICE descending", () => {
    const plan = buildSeoOptimizationPlan({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      pageTrends: trends,
      competitorSignals: [{ name: "BigCo", gainedKeywords: 8, growthPct: 25 }],
      targetKeywords: ["QR code"],
      coveredKeywords: [],
    });
    const ices = plan.tasks.map((t) => t.ice);
    expect(ices).toEqual([...ices].sort((a, b) => b - a));
  });

  it("exposes the declining page drop percentage in the detail", () => {
    const plan = buildSeoOptimizationPlan({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      pageTrends: [{ url: "/blog/d", previousVisits: 100, visits: 0 }],
      competitorSignals: [],
      targetKeywords: [],
      coveredKeywords: [],
    });
    expect(plan.tasks[0].detail).toContain("100%");
  });

  it("handles empty inputs gracefully", () => {
    const plan = buildSeoOptimizationPlan({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
      pageTrends: [],
      competitorSignals: [],
      targetKeywords: [],
      coveredKeywords: [],
    });
    expect(plan.tasks).toEqual([]);
  });
});
