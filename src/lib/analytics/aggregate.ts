/**
 * Analytics aggregation — Phase 6.
 *
 * Pure, deterministic transforms that turn raw Supabase rows into a dashboard
 * model. No IO, no AI — fully unit-testable. The page/route layer only fetches
 * rows and calls these functions.
 */

import { clamp, formatNumber } from "@/lib/utils";
import { ctrFrom } from "@/lib/reports/weekly";

export interface DailyMetricRow {
  metric_date: string;
  organic_visits: number | null;
  clicks: number | null;
  impressions: number | null;
  conversions: number | null;
  lead_downloads: number | null;
  revenue: number | null;
}

export interface PageMetricRow {
  url: string;
  visits: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  avg_position: number | null;
}

export interface ContentItemRow {
  id: string;
  title: string;
  status: string;
  quality_score: number | null;
  created_at: string;
  /** Present when the loader selects publishing fields (Sprint 4). */
  slug?: string | null;
  excerpt?: string | null;
  scheduled_for?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

export interface GenerationRunRow {
  module: string;
  status: string | null;
  cost_usd: number | null;
  created_at: string;
}

export interface AnalyticsInput {
  daily: DailyMetricRow[];
  pages: PageMetricRow[];
  content: ContentItemRow[];
  runs: GenerationRunRow[];
  /** Days of history to show. @default 30 */
  days?: number;
  /** Series end date (tests). @default today */
  end?: Date;
}

export interface AnalyticsPoint {
  label: string; // e.g. "Jul 01"
  date: string; // ISO yyyy-mm-dd
  visits: number;
  clicks: number;
  impressions: number;
}

export interface AnalyticsSummary {
  publishedCount: number;
  totalVisits: number;
  totalClicks: number;
  totalImpressions: number;
  totalConversions: number;
  totalDownloads: number;
  totalRevenue: number;
  ctr: number;
  avgQualityScore: number;
  aiRuns: number;
  aiCostUsd: number;
  modules: Array<{ module: string; runs: number }>;
  qualityBuckets: Array<{ label: string; count: number }>;
}

export interface AnalyticsModel {
  summary: AnalyticsSummary;
  series: AnalyticsPoint[];
  topPages: Array<{ url: string; visits: number; clicks: number; ctr: number }>;
  statusDistribution: Array<{ status: string; count: number }>;
}

export const QUALITY_BUCKETS = [
  { label: "≥ 90", min: 90 },
  { label: "80-89", min: 80 },
  { label: "60-79", min: 60 },
  { label: "< 60", min: 0 },
] as const;

/** Fill missing days with zeros so the chart is continuous. */
export function buildSeries(daily: DailyMetricRow[], days = 30, end: Date = new Date()): AnalyticsPoint[] {
  const byDate = new Map<string, DailyMetricRow>();
  for (const row of daily) {
    const key = row.metric_date.slice(0, 10);
    byDate.set(key, row);
  }

  const points: AnalyticsPoint[] = [];
  const today = new Date(end);
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = toLocalIso(day);
    const row = byDate.get(key);
    points.push({
      label: key.slice(5, 10),
      date: key,
      visits: row?.organic_visits ?? 0,
      clicks: row?.clicks ?? 0,
      impressions: row?.impressions ?? 0,
    });
  }
  return points;
}

/** Format a local date as yyyy-mm-dd (avoids UTC shift). */
function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function summarize(input: Omit<AnalyticsInput, "days">): AnalyticsSummary {
  const published = input.content.filter((c) => c.status === "published");

  const sum = (key: "organic_visits" | "clicks" | "impressions" | "conversions" | "lead_downloads" | "revenue") =>
    input.daily.reduce((acc, r) => acc + (r[key] ?? 0), 0);

  const impressions = sum("impressions");
  const clicks = sum("clicks");

  const qualityScores = input.content
    .map((c) => c.quality_score)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  const modulesMap = new Map<string, number>();
  for (const run of input.runs) {
    modulesMap.set(run.module, (modulesMap.get(run.module) ?? 0) + 1);
  }

  const qualityBuckets = QUALITY_BUCKETS.map((bucket) => {
    const count = qualityScores.filter(
      (score) => score >= bucket.min && (bucket.min === 0 || score < 90 || bucket.label.startsWith("≥"))
    ).length;
    return { label: bucket.label, count };
  });

  return {
    publishedCount: published.length,
    totalVisits: sum("organic_visits"),
    totalClicks: clicks,
    totalImpressions: impressions,
    totalConversions: sum("conversions"),
    totalDownloads: sum("lead_downloads"),
    totalRevenue: sum("revenue"),
    ctr: ctrFrom(impressions, clicks),
    avgQualityScore:
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0,
    aiRuns: input.runs.length,
    aiCostUsd: input.runs.reduce((acc, r) => acc + (r.cost_usd ?? 0), 0),
    modules: [...modulesMap.entries()]
      .map(([module, runs]) => ({ module, runs }))
      .sort((a, b) => b.runs - a.runs),
    qualityBuckets,
  };
}

/** Rank pages by visits (top 5). */
export function rankTopPages(pages: PageMetricRow[], limit = 5) {
  return pages
    .filter((p) => (p.visits ?? 0) > 0 || (p.clicks ?? 0) > 0)
    .sort((a, b) => (b.visits ?? 0) - (a.visits ?? 0))
    .slice(0, limit)
    .map((p) => ({
      url: p.url,
      visits: p.visits ?? 0,
      clicks: p.clicks ?? 0,
      ctr: typeof p.ctr === "number" ? p.ctr : ctrFrom(p.impressions ?? 0, p.clicks ?? 0),
    }));
}

/** Count content by status (published first). */
export function statusDistribution(content: ContentItemRow[]) {
  const map = new Map<string, number>();
  for (const item of content) {
    map.set(item.status, (map.get(item.status) ?? 0) + 1);
  }
  const order = ["published", "ready", "draft", "idea", "writing", "quality", "approved", "queued"];
  return [...map.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      if (ia === -1 && ib === -1) return b[1] - a[1];
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map(([status, count]) => ({ status, count }));
}

/** Build the full dashboard model. */
export function buildAnalyticsModel(input: AnalyticsInput): AnalyticsModel {
  const days = clamp(input.days ?? 30, 1, 90);
  return {
    summary: summarize(input),
    series: buildSeries(input.daily, days, input.end),
    topPages: rankTopPages(input.pages),
    statusDistribution: statusDistribution(input.content),
  };
}

/** Compact helpers for display formatting. */
export function displayVisits(value: number): string {
  return formatNumber(value);
}
