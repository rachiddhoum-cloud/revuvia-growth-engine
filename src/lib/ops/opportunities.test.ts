import { describe, expect, it } from "vitest";

import {
  buildOpportunities,
  competitorWeaknessOpportunities,
  localOpportunities,
  seasonalOpportunities,
  trendingOpportunities,
} from "@/lib/ops/opportunities";

const base = {
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  topics: ["SEO local"],
  industries: ["restaurants", "salons"],
  trendingQueries: [
    { query: "qr code menu", growthPct: 40 },
    { query: "avis google", growthPct: 5 },
  ],
  competitorWeaknesses: [{ name: "BigCo", weakness: "no local pages" }],
};

describe("seasonalOpportunities", () => {
  it("maps months to seasonal topics", () => {
    const opps = seasonalOpportunities(8, base.topics);
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0].kind).toBe("seasonal");
    expect(opps[0].roiScore).toBeGreaterThanOrEqual(80);
  });

  it("returns nothing for unknown months", () => {
    expect(seasonalOpportunities(99, base.topics)).toEqual([]);
  });
});

describe("trendingOpportunities", () => {
  it("keeps only queries above the growth threshold", () => {
    const opps = trendingOpportunities(base.trendingQueries);
    expect(opps.map((o) => o.title)).toContain("Trending: qr code menu");
    expect(opps.some((o) => o.title.includes("avis google"))).toBe(false);
  });

  it("scales ROI with growth", () => {
    const opps = trendingOpportunities([{ query: "x", growthPct: 80 }]);
    expect(opps[0].roiScore).toBeGreaterThan(80);
  });
});

describe("localOpportunities", () => {
  it("creates one opportunity per industry for the city", () => {
    const opps = localOpportunities("Marrakech", base.industries);
    expect(opps.map((o) => o.title)).toContain("Local: restaurants in Marrakech");
  });
});

describe("competitorWeaknessOpportunities", () => {
  it("exploits every weakness signal", () => {
    const opps = competitorWeaknessOpportunities(base.competitorWeaknesses);
    expect(opps[0].title).toBe("Outrank BigCo");
    expect(opps[0].detail).toContain("no local pages");
  });
});

describe("buildOpportunities", () => {
  it("combines and ranks all opportunities by ROI", () => {
    const scan = buildOpportunities({ ...base, month: 8, city: "Marrakech" });
    expect(scan.opportunities.length).toBe(5);
    const rois = scan.opportunities.map((o) => o.roiScore);
    expect(rois).toEqual([...rois].sort((a, b) => b - a));
  });

  it("skips seasonal and local when not provided", () => {
    const scan = buildOpportunities({ ...base, month: undefined, city: undefined });
    expect(scan.opportunities.some((o) => o.kind === "seasonal")).toBe(false);
    expect(scan.opportunities.some((o) => o.kind === "local")).toBe(false);
  });

  it("every opportunity carries traffic, leads and MRR estimates", () => {
    const scan = buildOpportunities({ ...base, month: 8, city: "Marrakech" });
    for (const opp of scan.opportunities) {
      expect(opp.estTraffic).toBeGreaterThan(0);
      expect(opp.estLeads).toBeGreaterThan(0);
      expect(opp.estMrrUsd).toBeGreaterThan(0);
    }
  });

  it("is deterministic", () => {
    const a = buildOpportunities({ ...base, month: 8, city: "Marrakech" });
    const b = buildOpportunities({ ...base, month: 8, city: "Marrakech" });
    expect(a).toEqual(b);
  });
});
