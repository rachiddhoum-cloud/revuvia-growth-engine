/**
 * AI confidence model — Sprint 8, Phase 6.
 *
 * Every recommendation exposes the same model: confidence, expected ROI,
 * traffic, leads, revenue, MRR and ICE, backed by historical evidence from
 * the knowledge base. Pure and deterministic.
 */

import { clamp } from "@/lib/utils";
import { iceScore } from "@/lib/ops/ice";
import type { ConfidenceModel, KnowledgeEntry, StrategyType } from "@/lib/learning/types";

export interface ConfidenceInput {
  strategyType: StrategyType;
  /** Exact strategy key (e.g. "title_has_number"). */
  key?: string;
  /** Free-text topic for fuzzy matching (e.g. "seo audit"). */
  topic?: string;
  baseImpact: number; // 0-10
  baseEase?: number; // 0-10
  knowledge: KnowledgeEntry[];
  baselineTraffic?: number;
  acvUsd?: number;
  conversionRate?: number;
}

/** Human-readable label for a strategy key. */
export function humanizeKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.length > 0 ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

/** Evidence entries matching a strategy type + key/topic. */
export function findEvidence(
  knowledge: KnowledgeEntry[],
  strategyType: StrategyType,
  key?: string,
  topic?: string
): KnowledgeEntry[] {
  const topicTokens = (topic ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  const matches = knowledge.filter((e) => {
    if (e.strategyType !== strategyType) return false;
    if (key) {
      return e.key === key || e.key.includes(key) || key.includes(e.key);
    }
    if (topicTokens.length > 0) {
      return topicTokens.some((t) => e.key.toLowerCase().includes(t));
    }
    return true;
  });
  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

/** One-line evidence statement for reports. */
export function evidenceLine(entry: KnowledgeEntry): string {
  const sign = entry.upliftPct >= 0 ? "+" : "";
  return `${humanizeKey(entry.key)} (${entry.attempts} samples): ${sign}${entry.upliftPct}% traffic, ${Math.round(entry.metrics.avgLeads)} leads avg, confidence ${Math.round(entry.confidence * 100)}%.`;
}

/**
 * Build the confidence model for a recommendation using the strongest
 * historical evidence available.
 */
export function recommendationConfidence(input: ConfidenceInput): ConfidenceModel {
  const evidence = findEvidence(input.knowledge, input.strategyType, input.key, input.topic);
  const ease = input.baseEase ?? 6;
  const acv = input.acvUsd ?? 100;
  const conversion = input.conversionRate ?? 0.02;

  const confidence =
    evidence.length > 0
      ? clamp(
          evidence.reduce((a, e) => a + e.confidence, 0) / evidence.length,
          0.05,
          0.95
        )
      : 0.5;

  const refTraffic = evidence.reduce(
    (a, e) => a + e.metrics.avgTraffic * e.attempts,
    0
  ) / Math.max(evidence.reduce((a, e) => a + e.attempts, 0), 1);

  const uplift = evidence.reduce((a, e) => a + e.upliftPct, 0) / Math.max(evidence.length, 1);

  let expectedTraffic = refTraffic;
  if (input.baselineTraffic !== undefined) {
    expectedTraffic = input.baselineTraffic * (1 + Math.max(0, uplift) / 100);
  }
  expectedTraffic = Math.round(expectedTraffic);

  const expectedLeads = Math.round(expectedTraffic * conversion);
  const expectedRevenue = Math.round(expectedLeads * acv);
  const expectedMrrUsd = Math.round(expectedRevenue / 12);
  const expectedRoiUsd = Math.round(expectedRevenue * 0.7);

  const ice = iceScore(clamp(input.baseImpact + Math.max(0, uplift) / 25, 0, 10), confidence * 10, ease);

  return {
    confidence: Math.round(confidence * 1000) / 1000,
    expectedRoiUsd,
    expectedTraffic,
    expectedLeads,
    expectedRevenue,
    expectedMrrUsd,
    ice,
    evidence: evidence.map(evidenceLine),
  };
}
