/**
 * SEO Health Score — Sprint 5, Phase 8.
 *
 * Real-data 0-100 score computed from GSC history. Eight dimensions:
 * visibility (impressions), traffic (clicks), click-through, ranking
 * position, momentum (7d vs 28d), content freshness, internal link
 * coverage and query distribution (no single-keyword dependency).
 * Trend compares the current week against the previous week.
 */

import { clamp } from "@/lib/utils";

export interface HealthMetrics {
  /** 7d window (current). */
  current: MetricsWindow;
  /** 28d window (previous). */
  previous: MetricsWindow;
  internalLinkCoveragePct: number;
}

export interface MetricsWindow {
  clicks: number;
  impressions: number;
  ctr: number; // 0-1
  avgPosition: number; // 1-100 (lower = better)
  /** GSC pages with clicks. */
  pagesWithClicks: number;
  /** GSC queries with clicks. */
  queriesWithClicks: number;
  /** Top query share of total clicks (0-1). */
  topQueryShare: number;
  /** Content published in the last 30 days. */
  publishedLast30d: number;
  /** Published content touched (edited) in the last 30 days. */
  refreshedLast30d: number;
}

export type HealthDimension =
  | "visibility"
  | "traffic"
  | "click_through"
  | "ranking"
  | "momentum"
  | "freshness"
  | "link_coverage"
  | "distribution";

export interface SeoHealthScore {
  date: string;
  total: number;
  dimensions: Record<HealthDimension, number>;
  trend: "up" | "down" | "flat";
  previousTotal: number | null;
}

export const HEALTH_WEIGHTS: Record<HealthDimension, number> = {
  visibility: 0.15,
  traffic: 0.2,
  click_through: 0.15,
  ranking: 0.15,
  momentum: 0.1,
  freshness: 0.1,
  link_coverage: 0.1,
  distribution: 0.05,
};

export function visibilityDimension(w: MetricsWindow, prev: MetricsWindow): number {
  const growth = prev.impressions > 0 ? (w.impressions - prev.impressions) / prev.impressions : 0;
  return clamp(Math.round(40 + growth * 250), 0, 100);
}

export function trafficDimension(w: MetricsWindow, prev: MetricsWindow): number {
  const growth = prev.clicks > 0 ? (w.clicks - prev.clicks) / prev.clicks : 0;
  return clamp(Math.round(35 + growth * 250), 0, 100);
}

export function clickThroughDimension(w: MetricsWindow): number {
  return clamp(Math.round(w.ctr * 2000), 0, 100);
}

export function rankingDimension(w: MetricsWindow): number {
  const avg = w.avgPosition > 0 ? w.avgPosition : 20;
  return clamp(Math.round(100 - avg * 4), 5, 95);
}

export function momentumDimension(w: MetricsWindow, prev: MetricsWindow): number {
  const now = w.clicks + w.impressions;
  const then = prev.clicks + prev.impressions;
  if (then <= 0) return now > 0 ? 55 : 0;
  return clamp(Math.round(50 + ((now - then) / then) * 150), 0, 100);
}

export function freshnessDimension(w: MetricsWindow): number {
  const touched = w.publishedLast30d + w.refreshedLast30d;
  return clamp(Math.round(Math.min(touched, 10) * 10), 0, 100);
}

export function linkCoverageDimension(pct: number): number {
  return clamp(Math.round(pct), 0, 100);
}

export function distributionDimension(w: MetricsWindow): number {
  // 1 - topQueryShare; 20+ queries carrying clicks → healthy.
  const diversity = clamp(Math.round(Math.min(w.queriesWithClicks, 20) * 3), 0, 60);
  return clamp(Math.round(diversity + (1 - w.topQueryShare) * 40), 0, 100);
}

function dimensionsFor(w: MetricsWindow, prev: MetricsWindow, coveragePct: number): Record<HealthDimension, number> {
  return {
    visibility: visibilityDimension(w, prev),
    traffic: trafficDimension(w, prev),
    click_through: clickThroughDimension(w),
    ranking: rankingDimension(w),
    momentum: momentumDimension(w, prev),
    freshness: freshnessDimension(w),
    link_coverage: linkCoverageDimension(coveragePct),
    distribution: distributionDimension(w),
  };
}

function totalFor(dims: Record<HealthDimension, number>): number {
  return clamp(
    Math.round(
      Object.entries(dims).reduce((acc, [key, value]) => acc + value * HEALTH_WEIGHTS[key as HealthDimension], 0)
    ),
    0,
    100
  );
}

export function buildSeoHealthScore(input: HealthMetrics, date?: string): SeoHealthScore {
  const hasData = input.current.clicks > 0 || input.current.impressions > 0 || input.current.pagesWithClicks > 0;
  if (!hasData) {
    const dims = dimensionsFor(input.current, input.previous, input.internalLinkCoveragePct);
    return {
      date: date ?? new Date().toISOString().slice(0, 10),
      total: 0,
      dimensions: Object.fromEntries(Object.keys(dims).map((k) => [k, 0])) as Record<HealthDimension, number>,
      trend: "flat",
      previousTotal: null,
    };
  }
  const dims = dimensionsFor(input.current, input.previous, input.internalLinkCoveragePct);
  const total = totalFor(dims);

  const hasHistory =
    input.previous.clicks > 0 || input.previous.impressions > 0 || input.previous.pagesWithClicks > 0;
  const previousTotal = hasHistory ? totalFor(dimensionsFor(input.previous, input.previous, input.internalLinkCoveragePct)) : null;

  return {
    date: date ?? new Date().toISOString().slice(0, 10),
    total,
    dimensions: dims,
    trend:
      previousTotal === null
        ? "flat"
        : total > previousTotal
          ? "up"
          : total < previousTotal
            ? "down"
            : "flat",
    previousTotal,
  };
}
