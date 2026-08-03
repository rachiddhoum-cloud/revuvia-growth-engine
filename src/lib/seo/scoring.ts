import type { KeywordIntent, SerpFeature } from "@/types";

/**
 * SEO scoring utilities for Module 1.
 * Difficulty and opportunity estimates are deterministic heuristics that can be
 * refined with live SERP data. Keep pure and unit-testable.
 */

const INTENT_KEYWORDS: Record<Exclude<KeywordIntent, "navigational">, RegExp> = {
  transactional: /acheter|buy|commander|order|pricing|tarif|abonnement|subscription|devis|quote|promo|discount/i,
  commercial: /meilleur|best|comparer|compare|alternatif|alternative|top|avis|review|vs|versus|guide|how to choose|choisir/i,
  informational: /comment|how|what|pourquoi|why|astuce|tip|guide|tutoriel|tutorial|conseil|ideas|idée/i,
};

export function classifyIntent(keyword: string): KeywordIntent {
  const lower = keyword.trim();
  if (INTENT_KEYWORDS.transactional.test(lower)) return "transactional";
  if (INTENT_KEYWORDS.commercial.test(lower)) return "commercial";
  if (INTENT_KEYWORDS.informational.test(lower)) return "informational";
  return "navigational";
}

/** Number of words as a cheap proxy for topic breadth. */
export function keywordLengthScore(keyword: string): number {
  const words = keyword.trim().split(/\s+/).length;
  return Math.min(words, 8);
}

/**
 * Estimate SERP difficulty (0-100).
 * When live data is missing, derives from keyword length, intent and a base signal.
 */
export function estimateDifficulty(input: {
  keyword: string;
  domainAuthority?: number;
  competitorAuthority?: number;
  baseSignal?: number; // 0-100, from live SERP analysis
}): number {
  const { keyword, baseSignal } = input;
  if (typeof baseSignal === "number") {
    return clampDifficulty(baseSignal);
  }
  const intent = classifyIntent(keyword);
  const intentWeight = intent === "transactional" ? 18 : intent === "commercial" ? 12 : 6;
  const lengthPenalty = keywordLengthScore(keyword) >= 4 ? -6 : 0;
  const raw = 38 + intentWeight + lengthPenalty;
  return clampDifficulty(raw);
}

/** Opportunity score (0-100): high volume + low difficulty + commercial intent. */
export function opportunityScore(input: {
  keyword: string;
  volume: number;
  difficulty: number;
  intent: KeywordIntent;
}): number {
  const { volume, difficulty, intent } = input;
  const volumeComponent = Math.min(volume / 5000, 1) * 40; // up to 40
  const difficultyComponent = (1 - difficulty / 100) * 40; // up to 40
  const intentComponent = intent === "transactional" ? 20 : intent === "commercial" ? 15 : 8;
  return Math.round(clamp(volumeComponent + difficultyComponent + intentComponent, 0, 100));
}

export interface RankedOpportunity<T extends { opportunity_score: number }> {
  item: T;
  priority: number;
}

export function rankOpportunities<T extends { opportunity_score: number }>(items: T[]): RankedOpportunity<T>[] {
  return [...items]
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .map((item, index) => ({ item, priority: index + 1 }));
}

/** SERP feature detection from keyword patterns. */
export function detectSerpFeatures(keyword: string): SerpFeature[] {
  const features: SerpFeature[] = [];
  const lower = keyword.toLowerCase();
  if (/comment|how|what|pourquoi|why|astuce/.test(lower)) features.push("featured_snippet");
  if (/liste|list|best|meilleur|top/.test(lower)) features.push("people_also_ask");
  if (/[àa] proximit[ée]|near me|pr[èe]s de moi/.test(lower)) features.push("local_pack");
  if (/photo|image|recette|recipe|inspiration/.test(lower)) features.push("image_pack");
  if (/vid[ée]o|tutoriel|tutorial|how to/.test(lower)) features.push("video");
  if (/comparer|compare|vs|versus/.test(lower)) features.push("shopping");
  return features;
}

function clampDifficulty(value: number): number {
  return clamp(value, 0, 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
