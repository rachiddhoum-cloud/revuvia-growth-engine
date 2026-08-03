/**
 * SEO optimization loop — Sprint 4, Phase 3.
 *
 * Weekly: detects declining pages, rising competitors and keyword gaps,
 * then automatically creates optimization tasks ranked by ICE.
 * Deterministic; signals are injected (no scraping in this layer).
 */

import { iceScore } from "@/lib/ops/ice";
import type { SeoOptimizationPlan, SeoOptimizationTask } from "@/lib/ops/types";

export interface PageTrend {
  url: string;
  previousVisits: number;
  visits: number;
}

export interface CompetitorSignal {
  name: string;
  gainedKeywords: number;
  growthPct: number;
}

export interface SeoLoopInput {
  weekStart: string;
  weekEnd: string;
  pageTrends: PageTrend[];
  competitorSignals: CompetitorSignal[];
  /** Keywords we want to rank for but have no content covering. */
  targetKeywords: string[];
  /** Keywords already covered by published content. */
  coveredKeywords: string[];
}

/** Pages whose visits dropped by at least `thresholdPct`. */
export function findDecliningPages(trends: PageTrend[], thresholdPct = -10): PageTrend[] {
  return trends
    .filter((t) => t.previousVisits > 0 && t.visits < t.previousVisits)
    .filter((t) => (t.visits - t.previousVisits) / t.previousVisits <= thresholdPct / 100)
    .sort((a, b) => {
      const pctA = (a.visits - a.previousVisits) / a.previousVisits;
      const pctB = (b.visits - b.previousVisits) / b.previousVisits;
      return pctA - pctB;
    });
}

/** Competitors growing faster than `growthThresholdPct`. */
export function risingCompetitors(
  signals: CompetitorSignal[],
  growthThresholdPct = 10
): CompetitorSignal[] {
  return signals
    .filter((s) => s.growthPct > growthThresholdPct)
    .sort((a, b) => b.growthPct - a.growthPct || b.gainedKeywords - a.gainedKeywords);
}

/** Target keywords with no coverage yet. */
export function keywordGaps(targetKeywords: string[], coveredKeywords: string[]): string[] {
  const covered = new Set(coveredKeywords.map((k) => k.trim().toLowerCase()));
  return [...new Set(targetKeywords.map((k) => k.trim()))].filter(
    (k) => !covered.has(k.toLowerCase())
  );
}

/** Build the weekly SEO optimization plan (tasks sorted by ICE desc). */
export function buildSeoOptimizationPlan(input: SeoLoopInput): SeoOptimizationPlan {
  const { weekStart, weekEnd, pageTrends, competitorSignals, targetKeywords, coveredKeywords } = input;

  const declining = findDecliningPages(pageTrends);
  const competitors = risingCompetitors(competitorSignals);
  const gaps = keywordGaps(targetKeywords, coveredKeywords);

  const tasks: SeoOptimizationTask[] = [];

  declining.forEach((page, i) => {
    const drop = Math.round(((page.previousVisits - page.visits) / page.previousVisits) * 100);
    tasks.push({
      id: `seo-declining-${i}`,
      source: "declining_page",
      title: `Revive ${page.url}`,
      detail: `Traffic dropped ${drop}% (${page.previousVisits} → ${page.visits} visits). Refresh content, internal links and meta.`,
      impact: 8,
      ease: 6,
      ice: iceScore(8, 0.8, 6),
    });
  });

  competitors.forEach((c, i) => {
    tasks.push({
      id: `seo-competitor-${i}`,
      source: "rising_competitor",
      title: `Counter ${c.name}`,
      detail: `${c.name} grew ${c.growthPct}% with ${c.gainedKeywords} new keywords. Publish competing content and build links.`,
      impact: 7,
      ease: 5,
      ice: iceScore(7, 0.7, 5),
    });
  });

  gaps.slice(0, 10).forEach((kw, i) => {
    tasks.push({
      id: `seo-gap-${i}`,
      source: "keyword_gap",
      title: `Cover "${kw}"`,
      detail: `No content targets "${kw}" yet. Queue an article with this primary keyword.`,
      impact: 7,
      ease: 7,
      ice: iceScore(7, 0.75, 7),
    });
  });

  tasks.sort((a, b) => b.ice - a.ice || a.id.localeCompare(b.id));

  return {
    weekStart,
    weekEnd,
    tasks,
    decliningPages: declining.map((p) => p.url),
    risingCompetitors: competitors.map((c) => c.name),
    keywordGaps: gaps,
  };
}
