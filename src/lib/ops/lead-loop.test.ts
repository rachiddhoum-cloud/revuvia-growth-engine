import { describe, expect, it } from "vitest";

import { buildGrowthSnapshot } from "@/lib/ops/snapshot";
import {
  buildLeadGenerationPlan,
  ctaImprovements,
  emailSequences,
  generateLeadMagnets,
  landingPageIdeas,
} from "@/lib/ops/lead-loop";
import type { GrowthSnapshot } from "@/lib/ops/types";

const baseInput = {
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  daily: [],
  pages: [],
  content: [
    { id: "1", title: "SEO pour restaurants", status: "published", quality_score: 85, created_at: "2026-07-01" },
    { id: "2", title: "Avis Google", status: "published", quality_score: 88, created_at: "2026-07-02" },
  ],
  runs: [],
  customers: [],
  prospects: [],
  keywords: ["SEO local", "avis google"],
};

const snapshot: GrowthSnapshot = buildGrowthSnapshot(baseInput);

describe("generateLeadMagnets", () => {
  it("creates one magnet per topic with rotating formats", () => {
    const magnets = generateLeadMagnets(["SEO local", "Avis Google"], 2);
    expect(magnets.map((m) => m.format)).toEqual(["checklist", "guide"]);
    expect(magnets[0].title).toContain("SEO local");
  });

  it("caps the number of magnets", () => {
    expect(generateLeadMagnets(["a", "b", "c", "d"], 2).length).toBe(2);
  });
});

describe("landingPageIdeas", () => {
  it("creates one landing per magnet", () => {
    const magnets = generateLeadMagnets(["SEO local"], 1);
    const landings = landingPageIdeas(magnets);
    expect(landings.length).toBe(1);
    expect(landings[0].kind).toBe("landing_page");
  });
});

describe("ctaImprovements", () => {
  it("flags weak conversion with a specific fix", () => {
    const weak = buildGrowthSnapshot({
      ...baseInput,
      daily: [
        {
          metric_date: "2026-08-05",
          organic_visits: 1000,
          clicks: 30,
          impressions: 3000,
          conversions: 1,
          lead_downloads: 0,
          revenue: 0,
        },
      ],
    });
    const ctas = ctaImprovements(weak);
    expect(ctas.some((c) => c.title.includes("above the fold"))).toBe(true);
  });

  it("always suggests magnet-specific CTAs", () => {
    expect(ctaImprovements(snapshot).length).toBeGreaterThanOrEqual(1);
  });
});

describe("emailSequences", () => {
  it("builds a 3-step nurture sequence per magnet", () => {
    const magnets = generateLeadMagnets(["SEO local"], 1);
    const sequences = emailSequences(magnets);
    expect(sequences.length).toBe(1);
    expect(sequences[0].detail).toContain("3 emails");
  });
});

describe("buildLeadGenerationPlan", () => {
  it("derives topics from content when none provided", () => {
    const plan = buildLeadGenerationPlan({ snapshot });
    expect(plan.topMagnets.length).toBeGreaterThan(0);
    expect(plan.items.length).toBeGreaterThan(0);
  });

  it("ranks all items by ICE descending", () => {
    const plan = buildLeadGenerationPlan({ snapshot, topics: ["SEO local"] });
    const ices = plan.items.map((i) => i.ice);
    expect(ices).toEqual([...ices].sort((a, b) => b - a));
  });

  it("covers all four lead kinds", () => {
    const plan = buildLeadGenerationPlan({ snapshot, topics: ["SEO local", "Avis", "QR"] });
    const kinds = new Set(plan.items.map((i) => i.kind));
    expect(kinds).toEqual(new Set(["lead_magnet", "landing_page", "cta", "email_sequence"]));
  });
});
