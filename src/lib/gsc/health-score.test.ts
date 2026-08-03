import { describe, expect, it } from "vitest";

import {
  buildSeoHealthScore,
  clickThroughDimension,
  distributionDimension,
  freshnessDimension,
  linkCoverageDimension,
  momentumDimension,
  rankingDimension,
  trafficDimension,
  visibilityDimension,
} from "@/lib/gsc/health-score";
import type { MetricsWindow } from "@/lib/gsc/health-score";

const baseWindow = (overrides: Partial<MetricsWindow> = {}): MetricsWindow => ({
  clicks: 100,
  impressions: 2000,
  ctr: 0.05,
  avgPosition: 8,
  pagesWithClicks: 12,
  queriesWithClicks: 30,
  topQueryShare: 0.1,
  publishedLast30d: 2,
  refreshedLast30d: 1,
  ...overrides,
});

describe("dimensions", () => {
  it("visibility grows with impressions", () => {
    expect(visibilityDimension(baseWindow(), baseWindow({ impressions: 1500 }))).toBeGreaterThan(50);
    expect(visibilityDimension(baseWindow(), baseWindow({ impressions: 3000 }))).toBeLessThan(50);
  });

  it("traffic grows with clicks", () => {
    expect(trafficDimension(baseWindow(), baseWindow({ clicks: 80 }))).toBeGreaterThan(50);
  });

  it("clickThrough rewards CTR", () => {
    expect(clickThroughDimension(baseWindow())).toBe(100);
    expect(clickThroughDimension(baseWindow({ ctr: 0.01 }))).toBe(20);
  });

  it("ranking rewards low positions", () => {
    expect(rankingDimension(baseWindow({ avgPosition: 3 }))).toBe(88);
    expect(rankingDimension(baseWindow({ avgPosition: 20 }))).toBe(20);
  });

  it("momentum reflects total activity growth", () => {
    expect(momentumDimension(baseWindow(), baseWindow({ clicks: 50, impressions: 1000 }))).toBeGreaterThan(50);
  });

  it("freshness scales with recent publishing", () => {
    expect(freshnessDimension(baseWindow())).toBe(30);
    expect(freshnessDimension(baseWindow({ publishedLast30d: 10, refreshedLast30d: 0 }))).toBe(100);
  });

  it("linkCoverage returns the percentage", () => {
    expect(linkCoverageDimension(75)).toBe(75);
  });

  it("distribution rewards query diversity", () => {
    expect(distributionDimension(baseWindow({ queriesWithClicks: 20, topQueryShare: 0 }))).toBe(100);
    expect(distributionDimension(baseWindow({ queriesWithClicks: 1, topQueryShare: 0.9 }))).toBe(7);
  });
});

describe("buildSeoHealthScore", () => {
  it("computes a 0-100 total with weighted dimensions", () => {
    const score = buildSeoHealthScore(
      {
        current: baseWindow(),
        previous: baseWindow({ clicks: 80, impressions: 1500 }),
        internalLinkCoveragePct: 60,
      },
      "2026-08-02"
    );
    expect(score.date).toBe("2026-08-02");
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
    expect(score.trend).toBe("up");
  });

  it("returns flat with no previous history", () => {
    const empty: MetricsWindow = {
      clicks: 0,
      impressions: 0,
      ctr: 0,
      avgPosition: 0,
      pagesWithClicks: 0,
      queriesWithClicks: 0,
      topQueryShare: 0,
      publishedLast30d: 0,
      refreshedLast30d: 0,
    };
    const score = buildSeoHealthScore({
      current: empty,
      previous: empty,
      internalLinkCoveragePct: 0,
    });
    expect(score.total).toBe(0);
    expect(score.trend).toBe("flat");
    expect(score.previousTotal).toBeNull();
  });
});
