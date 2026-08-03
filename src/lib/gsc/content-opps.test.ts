import { describe, expect, it } from "vitest";

import {
  buildContentOpportunities,
  clusterExpansions,
  longTailTargets,
  refreshCandidates,
  snippetTargets,
  uncoveredQueries,
} from "@/lib/gsc/content-opps";

const baseInput = {
  queries: [
    { query: "seo marrakech", clicks: 10, impressions: 500, position: 5 },
    { query: "seo marrakech prix", clicks: 2, impressions: 250, position: 9 },
    { query: "seo marrakech agence", clicks: 1, impressions: 80, position: 25 },
  ],
  pages: [
    { url: "/article/seo-marrakech", clicks: 10, position: 5 },
    { url: "/article/seo-marrakech-prix", clicks: 2, position: 9 },
  ],
  coverage: { "seo marrakech": "/article/seo-marrakech" },
  acvUsd: 100,
};

describe("uncoveredQueries", () => {
  it("returns queries without dedicated content", () => {
    const uncovered = uncoveredQueries(baseInput);
    expect(uncovered.map((q) => q.query)).toEqual(["seo marrakech prix", "seo marrakech agence"]);
  });
});

describe("snippetTargets", () => {
  it("finds positions 4-8 with >= 200 impressions", () => {
    const targets = snippetTargets(baseInput);
    expect(targets.map((q) => q.query)).toEqual(["seo marrakech"]);
  });
});

describe("longTailTargets", () => {
  it("finds queries at position >= 20 with >= 50 impressions", () => {
    expect(longTailTargets(baseInput).map((q) => q.query)).toEqual(["seo marrakech agence"]);
  });
});

describe("refreshCandidates", () => {
  it("finds pages with declining clicks", () => {
    const candidates = refreshCandidates(
      baseInput.pages,
      [{ url: "/article/seo-marrakech", clicks: 30, position: 4 }]
    );
    expect(candidates.map((p) => p.url)).toEqual(["/article/seo-marrakech"]);
  });
});

describe("clusterExpansions", () => {
  it("finds uncovered sibling queries of a base query", () => {
    const expansions = clusterExpansions(baseInput, "seo marrakech");
    expect(expansions.some((e) => e.query === "seo marrakech agence")).toBe(true);
    expect(expansions.every((e) => e.query.includes("seo marrakech"))).toBe(true);
  });
});

describe("buildContentOpportunities", () => {
  it("produces ranked content opportunities with ICE and ROI", () => {
    const opps = buildContentOpportunities(baseInput);
    expect(opps.some((o) => o.kind === "new_article")).toBe(true);
    expect(opps.some((o) => o.kind === "featured_snippet")).toBe(true);
    expect(opps.some((o) => o.kind === "long_tail_depth")).toBe(true);
    for (let i = 1; i < opps.length; i++) {
      expect(opps[i - 1].ice).toBeGreaterThanOrEqual(opps[i].ice);
    }
    for (const opp of opps) {
      expect(opp.estimatedRoiUsd).toBeGreaterThan(0);
    }
  });
});
