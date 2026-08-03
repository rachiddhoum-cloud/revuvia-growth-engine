import { describe, expect, it } from "vitest";

import { evidenceLine, findEvidence, humanizeKey, recommendationConfidence } from "@/lib/learning/confidence";
import { newEntry } from "@/lib/learning/memory";
import type { KnowledgeEntry } from "@/lib/learning/types";

const knowledge: KnowledgeEntry[] = [
  {
    ...newEntry("article_structure", "title_has_number"),
    confidence: 0.74,
    attempts: 4,
    successes: 3,
    failures: 1,
    metrics: { avgTraffic: 240, avgLeads: 12, avgCtr: 0.05, avgEngagement: 0.6, revenueUsd: 120 },
    upliftPct: 37,
  },
  {
    ...newEntry("keyword_cluster", "seo"),
    confidence: 0.62,
    attempts: 3,
    successes: 2,
    failures: 1,
    metrics: { avgTraffic: 45, avgLeads: 2, avgCtr: 0.04, avgEngagement: 0.3, revenueUsd: 20 },
    upliftPct: 12,
  },
  {
    ...newEntry("channel", "linkedin"),
    confidence: 0.3,
    attempts: 5,
    successes: 1,
    failures: 4,
    metrics: { avgTraffic: 5, avgLeads: 0, avgCtr: 0.01, avgEngagement: 0.2, revenueUsd: 0 },
    upliftPct: -22,
  },
];

describe("humanizeKey / evidenceLine", () => {
  it("humanizes keys and renders evidence lines", () => {
    expect(humanizeKey("title_has_number")).toBe("Title has number");
    const line = evidenceLine(knowledge[0]);
    expect(line).toContain("+37% traffic");
    expect(line).toContain("4 samples");
    expect(line).toContain("74%");
  });
});

describe("findEvidence", () => {
  it("matches by strategy type and exact key", () => {
    expect(findEvidence(knowledge, "article_structure", "title_has_number")).toHaveLength(1);
    expect(findEvidence(knowledge, "channel")).toHaveLength(1);
  });

  it("matches fuzzy by key containment", () => {
    expect(findEvidence(knowledge, "article_structure", "title")).toHaveLength(1);
  });

  it("matches by topic tokens and ranks by confidence", () => {
    const matches = findEvidence(knowledge, "keyword_cluster", undefined, "seo audit checklist");
    expect(matches.map((m) => m.key)).toEqual(["seo"]);
  });

  it("returns nothing for a mismatched strategy", () => {
    expect(findEvidence(knowledge, "lead_magnet", "anything")).toHaveLength(0);
  });
});

describe("recommendationConfidence", () => {
  it("falls back to neutral defaults without evidence", () => {
    const model = recommendationConfidence({
      strategyType: "article_structure",
      key: "unknown",
      baseImpact: 6,
      knowledge: [],
    });
    expect(model.confidence).toBe(0.5);
    expect(model.expectedTraffic).toBe(0);
    expect(model.evidence).toEqual([]);
    expect(model.ice).toBeGreaterThan(0);
  });

  it("uses historical evidence for the expected model", () => {
    const model = recommendationConfidence({
      strategyType: "article_structure",
      key: "title_has_number",
      baseImpact: 7,
      knowledge,
      baselineTraffic: 200,
      conversionRate: 0.02,
      acvUsd: 100,
    });
    expect(model.confidence).toBe(0.74);
    expect(model.expectedTraffic).toBe(Math.round(200 * 1.37));
    expect(model.expectedLeads).toBe(Math.round(model.expectedTraffic * 0.02));
    expect(model.expectedRevenue).toBe(Math.round(model.expectedLeads * 100));
    expect(model.expectedMrrUsd).toBe(Math.round(model.expectedRevenue / 12));
    expect(model.evidence).toHaveLength(1);
    expect(model.evidence[0]).toContain("+37% traffic");
  });

  it("depresses expectations when evidence is negative", () => {
    const model = recommendationConfidence({
      strategyType: "channel",
      key: "linkedin",
      baseImpact: 5,
      knowledge,
      baselineTraffic: 100,
    });
    expect(model.confidence).toBe(0.3);
    expect(model.expectedTraffic).toBe(100); // negative uplift never inflates
    expect(model.ice).toBeLessThan(300);
  });

  it("averages multiple evidence entries", () => {
    const model = recommendationConfidence({
      strategyType: "keyword_cluster",
      topic: "seo",
      baseImpact: 5,
      knowledge,
      baselineTraffic: 50,
    });
    expect(model.confidence).toBeCloseTo(0.62, 5);
  });
});
