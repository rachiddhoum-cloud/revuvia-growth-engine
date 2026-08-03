import { describe, expect, it } from "vitest";

import {
  buildForecast,
  buildGscRecommendations,
  fallingQueries,
  risingQueries,
  topLosingPages,
  topWinningPages,
} from "@/lib/gsc/recommendations";
import type { RecommendationInput } from "@/lib/gsc/recommendations";

const input: RecommendationInput = {
  pageTrends: [
    { url: "/blog/a", clicks: 30, previousClicks: 120, impressions: 900 },
    { url: "/blog/b", clicks: 90, previousClicks: 20, impressions: 700 },
    { url: "/blog/c", clicks: 40, previousClicks: 45, impressions: 300 },
  ],
  queryTrends: [
    { query: "kw up", clicks: 9, impressions: 800, position: 3, previousPosition: 7 },
    { query: "kw down", clicks: 3, impressions: 600, position: 9, previousPosition: 4 },
    { query: "kw flat", clicks: 4, impressions: 500, position: 5, previousPosition: 5 },
  ],
  healthMetrics: {
    current: {
      clicks: 160,
      impressions: 2400,
      ctr: 0.067,
      avgPosition: 7,
      pagesWithClicks: 8,
      queriesWithClicks: 20,
      topQueryShare: 0.2,
      publishedLast30d: 2,
      refreshedLast30d: 1,
    },
    previous: {
      clicks: 140,
      impressions: 2000,
      ctr: 0.07,
      avgPosition: 7,
      pagesWithClicks: 8,
      queriesWithClicks: 18,
      topQueryShare: 0.21,
      publishedLast30d: 2,
      refreshedLast30d: 1,
    },
    internalLinkCoveragePct: 55,
  },
  opportunities: [],
  contentOpps: [],
  conversionRate: 0.01,
  acvUsd: 100,
  forecastWeeks: 12,
};

describe("topLosingPages / topWinningPages", () => {
  it("finds the biggest losers and winners", () => {
    expect(topLosingPages(input.pageTrends).map((p) => p.url)).toEqual(["/blog/a", "/blog/c"]);
    expect(topWinningPages(input.pageTrends).map((p) => p.url)).toEqual(["/blog/b"]);
  });
});

describe("risingQueries / fallingQueries", () => {
  it("sorts by impressions and regressed positions", () => {
    expect(risingQueries(input.queryTrends).map((q) => q.query)).toEqual(["kw up", "kw down", "kw flat"]);
    expect(fallingQueries(input.queryTrends).map((q) => q.query)).toEqual(["kw down"]);
  });
});

describe("buildForecast", () => {
  it("compounds weekly visits and produces MRR estimates", () => {
    const forecast = buildForecast(100, 20, 100, 0.01, 4);
    expect(forecast).toHaveLength(4);
    expect(forecast[3].organicVisits).toBeGreaterThan(forecast[0].organicVisits);
    expect(forecast.every((f) => f.mrrUsd >= 0)).toBe(true);
  });
});

describe("buildGscRecommendations", () => {
  it("assembles the executive summary", () => {
    const recs = buildGscRecommendations(input);
    expect(recs.losingPages).toHaveLength(2);
    expect(recs.winningPages).toHaveLength(1);
    expect(recs.fallingQueries.map((q) => q.query)).toEqual(["kw down"]);
    expect(recs.forecast).toHaveLength(12);
    expect(recs.forecastAssumptions.length).toBeGreaterThanOrEqual(3);
    expect(recs.health.total).toBeGreaterThan(0);
  });
});
