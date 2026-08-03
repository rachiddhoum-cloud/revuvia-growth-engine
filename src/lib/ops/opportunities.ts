/**
 * Opportunity scanner — Sprint 4, Phase 5.
 *
 * Automatically detects seasonal keywords, trending searches, local
 * opportunities and competitor weaknesses, then ranks every opportunity by
 * estimated ROI (traffic → leads → MRR). Deterministic; signals injected.
 */

import type { Opportunity, OpportunityKind, OpportunityScan } from "@/lib/ops/types";

export interface TrendingQuery {
  query: string;
  growthPct: number;
}

export interface CompetitorWeaknessSignal {
  name: string;
  weakness: string;
}

export interface OpportunityInput {
  weekStart: string;
  weekEnd: string;
  /** 1-12 month for seasonality mapping. */
  month?: number;
  /** City for local SEO opportunities. */
  city?: string;
  topics: string[];
  industries: string[];
  trendingQueries: TrendingQuery[];
  competitorWeaknesses: CompetitorWeaknessSignal[];
}

const SEASONAL_MAP: Record<number, { label: string; topic: string }[]> = {
  1: [{ label: "new-year", topic: "resolutions" }],
  2: [{ label: "valentine", topic: "valentine's day" }],
  3: [{ label: "spring", topic: "spring offers" }],
  4: [{ label: "ramadan", topic: "ramadan" }],
  5: [{ label: "summer-prep", topic: "summer prep" }],
  6: [{ label: "summer", topic: "summer" }],
  7: [{ label: "holidays", topic: "summer holidays" }],
  8: [{ label: "back-to-school", topic: "rentrée" }],
  9: [{ label: "rentree", topic: "back to school" }],
  10: [{ label: "autumn", topic: "autumn" }],
  11: [{ label: "black-friday", topic: "black friday" }],
  12: [{ label: "holidays", topic: "year-end holidays" }],
};

function roiScoreFor(kind: OpportunityKind, base: number, growthPct = 0): number {
  const boost = kind === "trending" ? Math.min(growthPct, 60) : 0;
  return Math.max(0, Math.min(100, Math.round(base + boost)));
}

/** Seasonal keywords for the current month. */
export function seasonalOpportunities(month: number, topics: string[]): Opportunity[] {
  const seasons = SEASONAL_MAP[month] ?? [];
  return seasons.slice(0, 2).map((s, i) => {
    const angle = topics[i] ? ` for ${topics[i]}` : "";
    return {
      id: `opp-seasonal-${i}`,
      kind: "seasonal",
      title: `Seasonal: ${s.topic}${angle}`,
      detail: `Publish a "${s.topic}" article before ${s.label} search spikes.`,
      roiScore: 85,
      estTraffic: 120,
      estLeads: 2,
      estMrrUsd: 80,
    };
  });
}

/** Trending searches above the growth threshold. */
export function trendingOpportunities(
  queries: TrendingQuery[],
  growthThresholdPct = 15
): Opportunity[] {
  return queries
    .filter((q) => q.growthPct > growthThresholdPct)
    .sort((a, b) => b.growthPct - a.growthPct)
    .slice(0, 5)
    .map((q, i) => {
      const roi = roiScoreFor("trending", 70, q.growthPct);
      return {
        id: `opp-trending-${i}`,
        kind: "trending",
        title: `Trending: ${q.query}`,
        detail: `Search volume for "${q.query}" grew ${q.growthPct}%. Cover it before competitors do.`,
        roiScore: roi,
        estTraffic: Math.round(roi * 3),
        estLeads: Math.round(roi * 3 * 0.02),
        estMrrUsd: Math.round(roi * 3 * 0.02 * 40),
      };
    });
}

/** Local SEO opportunities per industry in a city. */
export function localOpportunities(city: string, industries: string[]): Opportunity[] {
  return industries.slice(0, 3).map((industry, i) => ({
    id: `opp-local-${i}`,
    kind: "local",
    title: `Local: ${industry} in ${city}`,
    detail: `Build a "${industry} ${city}" landing page targeting nearby searches.`,
    roiScore: 72,
    estTraffic: 90,
    estLeads: 2,
    estMrrUsd: 60,
  }));
}

/** Competitor weaknesses we can exploit. */
export function competitorWeaknessOpportunities(
  signals: CompetitorWeaknessSignal[]
): Opportunity[] {
  return signals.map((s, i) => ({
    id: `opp-competitor-${i}`,
    kind: "competitor_weakness",
    title: `Outrank ${s.name}`,
    detail: `${s.name} weakness: ${s.weakness}. Publish stronger content on this angle.`,
    roiScore: 65,
    estTraffic: 80,
    estLeads: 1,
    estMrrUsd: 50,
  }));
}

/** Build the weekly opportunity scan (ranked by ROI desc). */
export function buildOpportunities(input: OpportunityInput): OpportunityScan {
  const opportunities: Opportunity[] = [
    ...(input.month ? seasonalOpportunities(input.month, input.topics) : []),
    ...trendingOpportunities(input.trendingQueries),
    ...(input.city ? localOpportunities(input.city, input.industries) : []),
    ...competitorWeaknessOpportunities(input.competitorWeaknesses),
  ];

  opportunities.sort((a, b) => b.roiScore - a.roiScore || a.id.localeCompare(b.id));

  return { weekStart: input.weekStart, weekEnd: input.weekEnd, opportunities };
}
