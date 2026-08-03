import { describe, expect, it } from "vitest";

import { buildLearningInsights, doMoreLessons, insightsToMarkdown, learnedLessons, stopDoingLessons } from "@/lib/learning/insights";
import type { Failure, SuccessPattern } from "@/lib/learning/types";

const patterns: SuccessPattern[] = [
  { strategyType: "article_structure", key: "title_has_number", samples: 4, successRate: 0.75, avgTraffic: 240, avgLeads: 12, avgCtr: 0.05, upliftPct: 37, evidence: ["a", "b"] },
  { strategyType: "channel", key: "linkedin", samples: 3, successRate: 0.33, avgTraffic: 5, avgLeads: 0, avgCtr: 0.01, upliftPct: -22, evidence: ["p"] },
];

const failures: Failure[] = [
  {
    kind: "dead_keyword",
    target: "seo audit",
    detail: "Impressions collapsed by 80%.",
    severity: "high",
    correctiveAction: "Stop bidding on this query.",
  },
];

describe("learnedLessons / stopDoingLessons / doMoreLessons", () => {
  it("extracts lessons only from patterns with real uplift", () => {
    const learned = learnedLessons(patterns);
    expect(learned).toHaveLength(1);
    expect(learned[0]).toContain("37%");
    expect(doMoreLessons(patterns)).toHaveLength(1);
  });

  it("turns failures into corrective stop-doing lines", () => {
    const stop = stopDoingLessons(failures);
    expect(stop[0]).toContain("Stop bidding");
  });
});

describe("buildLearningInsights", () => {
  it("answers the three weekly questions", () => {
    const insights = buildLearningInsights({ weekStart: "2026-08-03", patterns, failures });
    expect(insights.learned.length).toBeGreaterThan(0);
    expect(insights.stopDoing).toHaveLength(1);
    expect(insights.doMore.length).toBeGreaterThan(0);
    expect(insights.patterns).toHaveLength(2);
    expect(insights.failures).toHaveLength(1);
  });

  it("produces a helpful placeholder when nothing is learned yet", () => {
    const insights = buildLearningInsights({ weekStart: "2026-08-03", patterns: [], failures: [] });
    expect(insights.learned[0]).toContain("Not enough historical data");
  });

  it("renders a complete markdown report", () => {
    const md = insightsToMarkdown(buildLearningInsights({ weekStart: "2026-08-03", patterns, failures }));
    expect(md).toContain("What did I learn last week?");
    expect(md).toContain("What should I stop doing?");
    expect(md).toContain("What should I do more?");
    expect(md).toContain("Success patterns detected");
    expect(md).toContain("Title has number");
  });
});
