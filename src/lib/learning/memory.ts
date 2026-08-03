/**
 * Performance memory — Sprint 8, Phases 1-2.
 *
 * Aggregates historical outcomes per strategy and updates the knowledge
 * base: confidence rises when a strategy performed, decays when it failed.
 * All pure and deterministic.
 */

import { clamp } from "@/lib/utils";
import type { KnowledgeEntry, KnowledgeMetrics } from "@/lib/learning/types";

export function emptyMetrics(): KnowledgeMetrics {
  return { avgTraffic: 0, avgLeads: 0, avgCtr: 0, avgEngagement: 0, revenueUsd: 0 };
}

/** Merge two metric snapshots (attempt-weighted averages). */
export function mergeMetrics(a: KnowledgeMetrics, b: KnowledgeMetrics, aWeight = 1, bWeight = 1): KnowledgeMetrics {
  const total = aWeight + bWeight;
  if (total <= 0) return emptyMetrics();
  const w = (v: number, v2: number) => (v * aWeight + v2 * bWeight) / total;
  return {
    avgTraffic: Math.round(w(a.avgTraffic, b.avgTraffic)),
    avgLeads: Math.round(w(a.avgLeads, b.avgLeads)),
    avgCtr: Math.round(w(a.avgCtr, b.avgCtr) * 10000) / 10000,
    avgEngagement: Math.round(w(a.avgEngagement, b.avgEngagement) * 10000) / 10000,
    revenueUsd: Math.round(w(a.revenueUsd, b.revenueUsd)),
  };
}

export type Outcome = "success" | "failure" | "neutral";

/**
 * Update a confidence value from an outcome.
 * Success: pulls toward 1 (asymptotic, 8% of the remaining gap).
 * Failure: decays 25% of the current value.
 */
export function updateConfidence(previous: number, outcome: Outcome): number {
  if (outcome === "success") return clamp(previous + 0.08 * (1 - previous), 0.05, 0.95);
  if (outcome === "failure") return clamp(previous * 0.75, 0.05, 0.95);
  return clamp(previous, 0.05, 0.95);
}

/**
 * Rate a new sample against the entry's current average: clearly above
 * (≥ +50%) is a success, clearly below (≤ -50%) is a failure.
 */
export function rateOutcome(sample: number, baseline: number): Outcome {
  if (baseline <= 0) return sample > 0 ? "success" : "neutral";
  if (sample >= baseline * 1.5) return "success";
  if (sample <= baseline * 0.5) return "failure";
  return "neutral";
}

/** Outcome implied by an uplift percentage. */
export function outcomeFromUplift(upliftPct: number): Outcome {
  if (upliftPct >= 15) return "success";
  if (upliftPct <= -15) return "failure";
  return "neutral";
}

/** Apply a new observation to an existing knowledge entry. */
export function applyObservation(
  entry: KnowledgeEntry,
  obs: { metrics: KnowledgeMetrics; outcome: Outcome; evidence?: string; upliftPct?: number }
): KnowledgeEntry {
  const merged = mergeMetrics(entry.metrics, obs.metrics, entry.attempts, 1);
  const evidence = obs.evidence && !entry.evidence.includes(obs.evidence) ? [...entry.evidence, obs.evidence] : entry.evidence;
  return {
    ...entry,
    confidence: updateConfidence(entry.confidence, obs.outcome),
    attempts: entry.attempts + 1,
    successes: entry.successes + (obs.outcome === "success" ? 1 : 0),
    failures: entry.failures + (obs.outcome === "failure" ? 1 : 0),
    metrics: merged,
    upliftPct: obs.upliftPct ?? entry.upliftPct,
    evidence,
    learnedAt: new Date().toISOString(),
  };
}

/** Fresh knowledge entry from the first observation. */
export function newEntry(strategyType: KnowledgeEntry["strategyType"], key: string): KnowledgeEntry {
  return {
    strategyType,
    key,
    confidence: 0.5,
    attempts: 0,
    successes: 0,
    failures: 0,
    metrics: emptyMetrics(),
    upliftPct: 0,
    evidence: [],
    learnedAt: null,
  };
}
