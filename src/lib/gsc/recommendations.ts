/**
 * CEO SEO recommendations — Sprint 5, Phase 9.
 *
 * Weekly (Sunday) executive summary: pages losing/gaining the most,
 * query trends worth attention, quick wins (high ICE, low effort),
 * content roadmap from the opportunity engine, and 12-week forecasts
 * for organic traffic and MRR derived from GSC momentum.
 */

import type { SeoOpportunity } from "@/lib/gsc/opportunities";
import type { ContentOpportunity } from "@/lib/gsc/content-opps";
import type { LinkingIntel } from "@/lib/gsc/linking-intel";
import { buildSeoHealthScore, type HealthMetrics } from "@/lib/gsc/health-score";
import type { ConfidenceModel } from "@/lib/learning/types";

export interface GscRecommendation {
  id: string;
  title: string;
  detail: string;
  ice: number;
  priority: string;
  sourceUrl: string | null;
  /** Learning engine: historical evidence behind this recommendation. */
  confidenceModel?: ConfidenceModel;
}

export interface TrafficForecast {
  week: number;
  organicVisits: number;
  mrrUsd: number;
}

export interface GscRecommendations {
  generatedAt: string;
  health: ReturnType<typeof buildSeoHealthScore>;
  losingPages: { url: string; clicks: number; previousClicks: number }[];
  winningPages: { url: string; clicks: number; previousClicks: number }[];
  risingQueries: { query: string; impressions: number; position: number }[];
  fallingQueries: { query: string; impressions: number; position: number; previousPosition: number }[];
  quickWins: GscRecommendation[];
  contentRoadmap: ContentOpportunity[];
  linkingIntel: LinkingIntel[];
  opportunities: SeoOpportunity[];
  forecast: TrafficForecast[];
  forecastAssumptions: string[];
}

export interface RecommendationInput {
  pageTrends: { url: string; clicks: number; previousClicks: number; impressions: number }[];
  queryTrends: { query: string; clicks: number; impressions: number; position: number; previousPosition: number }[];
  healthMetrics: HealthMetrics;
  opportunities: SeoOpportunity[];
  contentOpps: ContentOpportunity[];
  linkingIntel?: LinkingIntel[];
  conversionRate?: number;
  acvUsd?: number;
  forecastWeeks?: number;
}

/** Pages with the largest click drops (up to 5). */
export function topLosingPages(pages: RecommendationInput["pageTrends"]): RecommendationInput["pageTrends"] {
  return pages
    .filter((p) => p.previousClicks > p.clicks)
    .sort((a, b) => a.clicks / a.previousClicks - b.clicks / b.previousClicks)
    .slice(0, 5);
}

/** Pages with the largest click gains (up to 5). */
export function topWinningPages(pages: RecommendationInput["pageTrends"]): RecommendationInput["pageTrends"] {
  return pages
    .filter((p) => p.clicks > p.previousClicks && p.previousClicks > 0)
    .sort((a, b) => b.clicks / b.previousClicks - a.clicks / a.previousClicks)
    .slice(0, 5);
}

/** Queries whose impressions grew the most. */
export function risingQueries(queries: RecommendationInput["queryTrends"], top = 5): RecommendationInput["queryTrends"] {
  return queries
    .filter((q) => q.previousPosition > q.position || q.impressions > 0)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, top);
}

/** Queries whose position regressed the most. */
export function fallingQueries(queries: RecommendationInput["queryTrends"], top = 5): RecommendationInput["queryTrends"] {
  return queries
    .filter((q) => q.previousPosition > 0 && q.position > q.previousPosition)
    .sort((a, b) => b.position - a.position)
    .slice(0, top);
}

/** Forecast organic visits + MRR over `weeks` (exponential decay toward baseline). */
export function buildForecast(
  weeklyClicks: number,
  weeklyOppGain: number,
  acvUsd: number,
  conversionRate: number,
  weeks: number
): TrafficForecast[] {
  const forecast: TrafficForecast[] = [];
  let visits = weeklyClicks;
  for (let week = 1; week <= weeks; week++) {
    const growth = Math.max(0.02, 0.1 * Math.pow(0.82, week - 1));
    visits = Math.round(visits * (1 + growth));
    forecast.push({
      week,
      organicVisits: visits,
      mrrUsd: Math.round((visits * conversionRate * 0.25 * acvUsd) / 12 + weeklyOppGain * 0.25 * (acvUsd / 4)),
    });
  }
  return forecast;
}

export function buildGscRecommendations(input: RecommendationInput): GscRecommendations {
  const acv = input.acvUsd ?? 100;
  const conversion = input.conversionRate ?? 0.01;
  const weeks = input.forecastWeeks ?? 12;

  const weeklyClicks = input.healthMetrics.current.clicks;
  const oppGain = input.opportunities.reduce((acc, o) => acc + o.expectedTrafficGain, 0);

  const quickWins: GscRecommendation[] = input.opportunities
    .filter((o) => o.priority === "P0" || o.ice >= 300)
    .slice(0, 5)
    .map((o) => ({
      id: `quick-${o.id}`,
      title: o.title,
      detail: o.detail,
      ice: o.ice,
      priority: o.priority,
      sourceUrl: o.source,
    }));

  const contentRoadmap = input.contentOpps.slice(0, 6);

  return {
    generatedAt: new Date().toISOString(),
    health: buildSeoHealthScore(input.healthMetrics),
    losingPages: topLosingPages(input.pageTrends).map((p) => ({
      url: p.url,
      clicks: p.clicks,
      previousClicks: p.previousClicks,
    })),
    winningPages: topWinningPages(input.pageTrends).map((p) => ({
      url: p.url,
      clicks: p.clicks,
      previousClicks: p.previousClicks,
    })),
    risingQueries: risingQueries(input.queryTrends).map((q) => ({
      query: q.query,
      impressions: q.impressions,
      position: q.position,
    })),
    fallingQueries: fallingQueries(input.queryTrends).map((q) => ({
      query: q.query,
      impressions: q.impressions,
      position: q.position,
      previousPosition: q.previousPosition,
    })),
    quickWins,
    contentRoadmap,
    linkingIntel: input.linkingIntel ?? [],
    opportunities: input.opportunities,
    forecast: buildForecast(weeklyClicks, oppGain, acv, conversion, weeks),
    forecastAssumptions: [
      "Forecast based on last-28d GSC momentum with decaying growth.",
      `Opportunity engine estimates +${oppGain} weekly clicks if executed.`,
      `Assumes ${conversion * 100}% visitor→trial conversion and $${acv}/mo ACV.`,
    ],
  };
}
