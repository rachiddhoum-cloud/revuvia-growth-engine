import { describe, expect, it } from "vitest";

import {
  applyObservation,
  emptyMetrics,
  mergeMetrics,
  newEntry,
  outcomeFromUplift,
  rateOutcome,
  updateConfidence,
} from "@/lib/learning/memory";

describe("updateConfidence", () => {
  it("raises confidence on success, asymptotically toward 1", () => {
    expect(updateConfidence(0.5, "success")).toBeCloseTo(0.54, 5);
    expect(updateConfidence(0.9, "success")).toBeLessThan(1);
    expect(updateConfidence(0.95, "success")).toBeLessThanOrEqual(0.95);
  });

  it("decays confidence on failure", () => {
    expect(updateConfidence(0.8, "failure")).toBeCloseTo(0.6, 5);
    expect(updateConfidence(0.5, "failure")).toBeCloseTo(0.375, 5);
  });

  it("keeps confidence unchanged on neutral and clamps the range", () => {
    expect(updateConfidence(0.5, "neutral")).toBe(0.5);
    expect(updateConfidence(0.01, "failure")).toBeGreaterThanOrEqual(0.05);
  });

  it("never exceeds the 0.05-0.95 bounds", () => {
    const worst = updateConfidence(0.001, "failure");
    expect(worst).toBeGreaterThanOrEqual(0.05);
    expect(updateConfidence(1, "success")).toBeLessThanOrEqual(0.95);
  });
});

describe("rateOutcome / outcomeFromUplift", () => {
  it("rates samples against the baseline", () => {
    expect(rateOutcome(150, 100)).toBe("success");
    expect(rateOutcome(40, 100)).toBe("failure");
    expect(rateOutcome(90, 100)).toBe("neutral");
    expect(rateOutcome(10, 0)).toBe("success");
    expect(rateOutcome(0, 0)).toBe("neutral");
  });

  it("maps uplifts to outcomes", () => {
    expect(outcomeFromUplift(37)).toBe("success");
    expect(outcomeFromUplift(-25)).toBe("failure");
    expect(outcomeFromUplift(5)).toBe("neutral");
  });
});

describe("mergeMetrics / applyObservation", () => {
  it("merges metrics attempt-weighted", () => {
    const a = { avgTraffic: 100, avgLeads: 5, avgCtr: 0.02, avgEngagement: 0.5, revenueUsd: 40 };
    const b = { avgTraffic: 200, avgLeads: 15, avgCtr: 0.04, avgEngagement: 0.9, revenueUsd: 120 };
    const merged = mergeMetrics(a, b, 3, 1);
    expect(merged.avgTraffic).toBe(125);
    expect(merged.avgLeads).toBe(8);
    expect(merged.revenueUsd).toBe(60);
  });

  it("applies an observation and grows the counters", () => {
    const entry = newEntry("article_structure", "title_has_number");
    const updated = applyObservation(entry, {
      metrics: { avgTraffic: 120, avgLeads: 8, avgCtr: 0.03, avgEngagement: 0.4, revenueUsd: 50 },
      outcome: "success",
      evidence: "slug-a",
    });
    expect(updated.attempts).toBe(1);
    expect(updated.successes).toBe(1);
    expect(updated.failures).toBe(0);
    expect(updated.confidence).toBeGreaterThan(0.5);
    expect(updated.evidence).toContain("slug-a");
    expect(updated.learnedAt).toBeTruthy();
  });

  it("dedupes evidence and accumulates failures", () => {
    let entry = newEntry("channel", "linkedin");
    entry = applyObservation(entry, { metrics: emptyMetrics(), outcome: "failure", evidence: "post-1" });
    entry = applyObservation(entry, { metrics: emptyMetrics(), outcome: "failure", evidence: "post-1" });
    expect(entry.failures).toBe(2);
    expect(entry.evidence).toEqual(["post-1"]);
    expect(entry.confidence).toBeLessThan(0.5);
  });
});
