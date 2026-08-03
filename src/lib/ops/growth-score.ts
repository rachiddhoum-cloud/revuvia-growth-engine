/**
 * Growth score — Sprint 4, Phase 8.
 *
 * One score from 0 to 100 combining SEO, Content, Traffic, Leads,
 * Conversion, Revenue and Execution. `buildGrowthScore` accepts the
 * previous total to expose the trend; history lives in `reports`
 * (type `growth_score`) so evolution is visible over time.
 */

import { clamp } from "@/lib/utils";
import type { GrowthScore, GrowthScoreDimensions, GrowthSnapshot } from "@/lib/ops/types";

export interface GrowthScoreInput {
  snapshot: GrowthSnapshot;
  /** 0-1 share of planned actions actually executed. */
  completionRate?: number;
  previousTotal?: number | null;
  /** Real SEO health (GSC-backed 0-100). When provided it replaces the simulated SEO dimension. */
  seoHealth?: number | null;
}

export const WEIGHTS: { [K in keyof GrowthScoreDimensions]: number } = {
  seo: 0.15,
  content: 0.1,
  traffic: 0.2,
  leads: 0.15,
  conversion: 0.1,
  revenue: 0.2,
  execution: 0.1,
};

/** SEO dimension: position + impressions health (0-100), or real GSC health when provided. */
export function seoDimension(snapshot: GrowthSnapshot, seoHealth?: number | null): number {
  if (typeof seoHealth === "number") return clamp(Math.round(seoHealth), 0, 100);
  const positions = snapshot.pages
    .map((p) => p.avg_position)
    .filter((v): v is number => typeof v === "number" && v > 0);
  if (positions.length === 0) return snapshot.weekly.impressions > 0 ? 55 : 40;
  const avg = positions.reduce((a, b) => a + b, 0) / positions.length;
  return clamp(Math.round(100 - avg * 7), 20, 95);
}

/** Content dimension: quality + velocity (0-100). */
export function contentDimension(snapshot: GrowthSnapshot): number {
  const quality = clamp(Math.round(snapshot.qualityAverage), 0, 80);
  const velocity = clamp(snapshot.weekly.publishedCount * 5, 0, 20);
  return clamp(quality + velocity, 0, 100);
}

/** Traffic dimension: weekly growth vs previous week (0-100). */
export function trafficDimension(snapshot: GrowthSnapshot): number {
  const { weekly, previous } = snapshot;
  if (previous.visits <= 0) return weekly.visits > 0 ? 60 : 0;
  const growth = (weekly.visits - previous.visits) / previous.visits;
  return clamp(Math.round(50 + growth * 150), 0, 100);
}

/** Leads dimension: lead downloads per visit (0-100). */
export function leadsDimension(snapshot: GrowthSnapshot): number {
  if (snapshot.weekly.visits <= 0) return 0;
  const rate = snapshot.weekly.leads / snapshot.weekly.visits;
  return clamp(Math.round(rate * 2000), 0, 100);
}

/** Conversion dimension: signups per visit (0-100). */
export function conversionDimension(snapshot: GrowthSnapshot): number {
  return clamp(Math.round(snapshot.conversionRate * 5000), 0, 100);
}

/** Revenue dimension: MRR level + churn (0-100). */
export function revenueDimension(snapshot: GrowthSnapshot): number {
  const { mrrUsd, churned } = snapshot.customers;
  const level = clamp(Math.round(mrrUsd / 20), 0, 90);
  const churnPenalty = churned > 0 ? clamp(churned * 10, 0, 30) : 0;
  return clamp(level - churnPenalty, 0, 100);
}

/** Execution dimension: share of planned work actually done (0-100). */
export function executionDimension(completionRate: number): number {
  return clamp(Math.round(completionRate * 100), 0, 100);
}

export function buildGrowthScore(input: GrowthScoreInput): GrowthScore {
  const dims: GrowthScoreDimensions = {
    seo: seoDimension(input.snapshot, input.seoHealth),
    content: contentDimension(input.snapshot),
    traffic: trafficDimension(input.snapshot),
    leads: leadsDimension(input.snapshot),
    conversion: conversionDimension(input.snapshot),
    revenue: revenueDimension(input.snapshot),
    execution: executionDimension(input.completionRate ?? 0.5),
  };

  const total = clamp(
    Math.round(
      (dims.seo * WEIGHTS.seo +
        dims.content * WEIGHTS.content +
        dims.traffic * WEIGHTS.traffic +
        dims.leads * WEIGHTS.leads +
        dims.conversion * WEIGHTS.conversion +
        dims.revenue * WEIGHTS.revenue +
        dims.execution * WEIGHTS.execution) /
        1
    ),
    0,
    100
  );

  const previousTotal = input.previousTotal ?? null;
  const trend: GrowthScore["trend"] =
    previousTotal === null
      ? "flat"
      : total > previousTotal
        ? "up"
        : total < previousTotal
          ? "down"
          : "flat";

  return {
    date: input.snapshot.weekEnd,
    total,
    dimensions: dims,
    trend,
    previousTotal,
  };
}
