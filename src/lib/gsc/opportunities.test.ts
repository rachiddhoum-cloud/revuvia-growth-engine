import { describe, expect, it } from "vitest";

import {
  buildSeoOpportunities,
  decliningClicksPages,
  highImpressionLowCtr,
  losingRankQueries,
  losingTrafficPages,
  needsRefreshPages,
  noInternalLinksPages,
  stuckKeywords,
} from "@/lib/gsc/opportunities";

describe("losingTrafficPages", () => {
  it("finds pages with traffic down >= 15%", () => {
    const pages = [
      { url: "/a", previousClicks: 100, clicks: 70, impressions: 500, ctr: 0.14, position: 3 },
      { url: "/b", previousClicks: 100, clicks: 95, impressions: 500, ctr: 0.19, position: 2 },
      { url: "/c", previousClicks: 10, clicks: 20, impressions: 100, ctr: 0.2, position: 4 },
    ];
    const losing = losingTrafficPages(pages);
    expect(losing.map((p) => p.url)).toEqual(["/a"]);
  });
});

describe("losingRankQueries", () => {
  it("finds queries whose position got worse", () => {
    const queries = [
      { query: "a", previousClicks: 10, clicks: 8, previousPosition: 2, position: 5, impressions: 300 },
      { query: "b", previousClicks: 10, clicks: 12, previousPosition: 5, position: 2, impressions: 300 },
    ];
    expect(losingRankQueries(queries).map((q) => q.query)).toEqual(["a"]);
  });
});

describe("highImpressionLowCtr", () => {
  it("flags queries with impressions >= 300 and CTR below 2.5%", () => {
    const queries = [
      { query: "a", previousClicks: 0, clicks: 5, previousPosition: 3, position: 3, impressions: 1000 },
      { query: "b", previousClicks: 0, clicks: 100, previousPosition: 1, position: 1, impressions: 1000 },
      { query: "c", previousClicks: 0, clicks: 5, previousPosition: 3, position: 3, impressions: 100 },
    ];
    const flagged = highImpressionLowCtr(queries);
    expect(flagged.map((q) => q.query)).toEqual(["a"]);
  });
});

describe("stuckKeywords", () => {
  it("finds keywords between positions 8-20 with impressions >= 100", () => {
    const queries = [
      { query: "a", previousClicks: 0, clicks: 1, previousPosition: 7, position: 9, impressions: 150 },
      { query: "b", previousClicks: 0, clicks: 1, previousPosition: 3, position: 4, impressions: 150 },
      { query: "c", previousClicks: 0, clicks: 1, previousPosition: 2, position: 21, impressions: 150 },
    ];
    expect(stuckKeywords(queries).map((q) => q.query)).toEqual(["a"]);
  });
});

describe("decliningClicksPages / noInternalLinksPages / needsRefreshPages", () => {
  const pageTrends = [
    { url: "/old", previousClicks: 50, clicks: 30, impressions: 400, ctr: 0.08, position: 5 },
    { url: "/grow", previousClicks: 10, clicks: 40, impressions: 400, ctr: 0.1, position: 2 },
  ];

  it("finds any page with declining clicks", () => {
    expect(decliningClicksPages(pageTrends).map((p) => p.url)).toEqual(["/old"]);
  });

  it("deduplicates orphan URLs", () => {
    expect(noInternalLinksPages(["/x", "/y", "/x"])).toEqual(["/x", "/y"]);
  });

  it("flags old content with declining clicks", () => {
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString();
    const fresh = new Date().toISOString();
    const result = needsRefreshPages(pageTrends, [
      { url: "/old", createdAt: old },
      { url: "/grow", createdAt: fresh },
    ]);
    expect(result.map((p) => p.url)).toEqual(["/old"]);
  });
});

describe("buildSeoOpportunities", () => {
  it("returns opportunities ranked by ICE with traffic and ROI estimates", () => {
    const opps = buildSeoOpportunities({
      pageTrends: [
        { url: "/a", previousClicks: 100, clicks: 60, impressions: 500, ctr: 0.12, position: 3 },
        { url: "/b", previousClicks: 50, clicks: 50, impressions: 400, ctr: 0.13, position: 2 },
      ],
      queryTrends: [
        { query: "kw", previousClicks: 10, clicks: 8, previousPosition: 3, position: 6, impressions: 400 },
      ],
      orphanUrls: ["/orphan"],
      contentAges: [],
      acvUsd: 100,
    });
    expect(opps.length).toBeGreaterThanOrEqual(3);
    expect(opps[0].ice).toBeGreaterThanOrEqual(opps[opps.length - 1].ice);
    for (const opp of opps) {
      expect(opp.expectedTrafficGain).toBeGreaterThan(0);
      expect(opp.estimatedRoiUsd).toBeGreaterThan(0);
      expect(["P0", "P1", "P2"]).toContain(opp.priority);
    }
    expect(opps.some((o) => o.kind === "losing_traffic")).toBe(true);
    expect(opps.some((o) => o.kind === "no_internal_links")).toBe(true);
  });
});
