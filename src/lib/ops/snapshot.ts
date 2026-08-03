/**
 * Growth snapshot builder — Sprint 3.
 *
 * Aggregates raw Supabase rows into the `GrowthSnapshot` consumed by every
 * generator. Pure and deterministic; the server loader only fetches rows.
 */

import { ctrFrom } from "@/lib/reports/weekly";
import type {
  ContentItemRow,
  DailyMetricRow,
  GenerationRunRow,
  PageMetricRow,
} from "@/lib/analytics/aggregate";
import type { CustomerRow, ProspectRow } from "@/types/supabase";
import type { GrowthSnapshot, WeeklyMetrics } from "@/lib/ops/types";

export interface SnapshotInput {
  weekStart: string;
  weekEnd: string;
  daily: DailyMetricRow[];
  pages: PageMetricRow[];
  content: ContentItemRow[];
  runs: GenerationRunRow[];
  customers: CustomerRow[];
  prospects: ProspectRow[];
  keywords: string[];
}

/** Last N days for the weekly window (inclusive of the end date). */
export function weekWindow(days = 7, end: Date = new Date()): { start: string; end: string } {
  const endD = new Date(end);
  endD.setHours(0, 0, 0, 0);
  const startD = new Date(endD);
  startD.setDate(endD.getDate() - (days - 1));
  return { start: toLocalIso(startD), end: toLocalIso(endD) };
}

/** Format a local date as yyyy-mm-dd (avoids UTC shift). */
function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Standard organic CTR benchmark when impressions exist but CTR is missing. */
const SEO_CTR_BENCHMARK = 0.03;

function sumBy<K extends keyof DailyMetricRow>(
  rows: DailyMetricRow[],
  key: K
): number {
  return rows.reduce((acc, r) => acc + ((r[key] ?? 0) as number), 0);
}

/** Aggregate weekly metrics from daily rows (optionally filtered). */
export function aggregateWeekly(
  daily: DailyMetricRow[],
  publishedThisWeek: ContentItemRow[],
  runs: GenerationRunRow[]
): WeeklyMetrics {
  return {
    visits: sumBy(daily, "organic_visits"),
    clicks: sumBy(daily, "clicks"),
    impressions: sumBy(daily, "impressions"),
    conversions: sumBy(daily, "conversions"),
    leads: sumBy(daily, "lead_downloads"),
    signups: sumBy(daily, "conversions"),
    aiRuns: runs.length,
    aiCostUsd: runs.reduce((acc, r) => acc + (r.cost_usd ?? 0), 0),
    publishedCount: publishedThisWeek.length,
  };
}

/** Estimated SEO traffic: real visits, floored by impression benchmark. */
export function estimateSeoTraffic(daily: DailyMetricRow[]): number {
  const visits = sumBy(daily, "organic_visits");
  const impressions = sumBy(daily, "impressions");
  if (impressions <= 0) return visits;
  return Math.max(visits, Math.round(impressions * SEO_CTR_BENCHMARK));
}

/** Build the full snapshot used by all ops generators. */
export function buildGrowthSnapshot(input: SnapshotInput): GrowthSnapshot {
  const { weekStart, weekEnd, daily, pages, content, runs, customers, prospects, keywords } = input;

  const published = content.filter((c) => c.status === "published");
  const weekly = aggregateWeekly(daily, published, runs);
  const previous: WeeklyMetrics = {
    visits: 0,
    clicks: 0,
    impressions: 0,
    conversions: 0,
    leads: 0,
    signups: 0,
    aiRuns: 0,
    aiCostUsd: 0,
    publishedCount: 0,
  };

  const scores = content
    .map((c) => c.quality_score)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const paid = customers.filter((c) => c.status === "paid");

  return {
    weekStart,
    weekEnd,
    weekly,
    previous,
    conversionRate: weekly.visits > 0 ? weekly.conversions / weekly.visits : 0,
    estimatedSeoTraffic: estimateSeoTraffic(daily),
    customers: {
      trial: customers.filter((c) => c.status === "trial").length,
      paid: paid.length,
      churned: customers.filter((c) => c.status === "churned").length,
      mrrUsd: paid.reduce((acc, c) => acc + (c.mrr_usd ?? 0), 0),
    },
    qualityAverage: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    pages,
    content,
    runs,
    prospects,
    daily,
    keywords,
  };
}

export { ctrFrom };
