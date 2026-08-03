/**
 * SEO opportunity engine — Sprint 5, Phase 5.
 *
 * Consumes real GSC data (queries, pages, internal links) and automatically
 * detects: pages losing traffic, queries losing ranking, high impressions /
 * low CTR, keywords stuck in positions 8-20, pages with declining clicks,
 * pages with no internal links, pages needing refresh. Every opportunity
 * carries an ICE score, expected traffic gain, estimated ROI and priority.
 */

import { iceScore, priorityFromIce } from "@/lib/ops/ice";
import type { ActionPriority } from "@/lib/ops/types";

export type OpportunityKind =
  | "losing_traffic"
  | "losing_ranking"
  | "low_ctr"
  | "stuck_keyword"
  | "declining_clicks"
  | "no_internal_links"
  | "needs_refresh";

export interface SeoOpportunity {
  id: string;
  kind: OpportunityKind;
  title: string;
  detail: string;
  ice: number;
  expectedTrafficGain: number; // weekly clicks
  estimatedRoiUsd: number; // monthly
  priority: ActionPriority;
  source: string; // url or query
}

export interface QueryTrend {
  query: string;
  previousClicks: number;
  clicks: number;
  previousPosition: number;
  position: number;
  impressions: number;
}

export interface PageTrend {
  url: string;
  previousClicks: number;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface OppInput {
  pageTrends: PageTrend[];
  queryTrends: QueryTrend[];
  /** URLs present in GSC but with no row in internal_links. */
  orphanUrls: string[];
  /** Published content created_at (ISO) for freshness detection. */
  contentAges: { url: string; createdAt: string }[];
  /** Avg contract value used for ROI (USD/month). */
  acvUsd?: number;
}

export const LOW_CTR_BENCHMARK = 0.025;
export const STUCK_MIN_POSITION = 8;
export const STUCK_MAX_POSITION = 20;

/** Pages losing traffic (clicks down >= threshold). */
export function losingTrafficPages(trends: PageTrend[], thresholdPct = -15): PageTrend[] {
  return trends
    .filter((t) => t.previousClicks > 0 && t.clicks < t.previousClicks)
    .filter((t) => (t.clicks - t.previousClicks) / t.previousClicks <= thresholdPct / 100)
    .sort((a, b) => a.clicks / a.previousClicks - b.clicks / b.previousClicks);
}

/** Queries losing ranking (position got worse). */
export function losingRankQueries(trends: QueryTrend[]): QueryTrend[] {
  return trends
    .filter((t) => t.previousPosition > 0 && t.position > t.previousPosition)
    .sort((a, b) => b.position - a.position);
}

/** Queries with a lot of impressions but a CTR below benchmark. */
export function highImpressionLowCtr(
  trends: QueryTrend[],
  minImpressions = 300,
  benchmark = LOW_CTR_BENCHMARK
): QueryTrend[] {
  return trends
    .filter((t) => t.impressions >= minImpressions)
    .filter((t) => t.position > 0 && (t.clicks / t.impressions) < benchmark)
    .sort((a, b) => b.impressions - a.impressions);
}

/** Keywords stuck between positions 8-20 with meaningful impressions. */
export function stuckKeywords(trends: QueryTrend[], minImpressions = 100): QueryTrend[] {
  return trends
    .filter((t) => t.position >= STUCK_MIN_POSITION && t.position <= STUCK_MAX_POSITION)
    .filter((t) => t.impressions >= minImpressions)
    .sort((a, b) => b.impressions - a.impressions);
}

/** Pages with declining clicks (same as losing traffic but clicks-based). */
export function decliningClicksPages(trends: PageTrend[]): PageTrend[] {
  return trends.filter((t) => t.previousClicks > 0 && t.clicks < t.previousClicks);
}

/** Pages present in GSC with no internal links. */
export function noInternalLinksPages(orphanUrls: string[]): string[] {
  return [...new Set(orphanUrls)].sort();
}

/** Pages whose content is old and traffic is declining → refresh. */
export function needsRefreshPages(
  trends: PageTrend[],
  contentAges: { url: string; createdAt: string }[],
  maxAgeDays = 90
): PageTrend[] {
  const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000).getTime();
  const oldUrls = new Set(
    contentAges.filter((c) => new Date(c.createdAt).getTime() < cutoff).map((c) => c.url)
  );
  return decliningClicksPages(trends).filter((t) => oldUrls.has(t.url));
}

/** Build every opportunity, ranked by ICE, each with traffic/ROI estimates. */
export function buildSeoOpportunities(input: OppInput): SeoOpportunity[] {
  const acv = input.acvUsd ?? 100;
  const opportunities: SeoOpportunity[] = [];
  let index = 0;

  const push = (opp: Omit<SeoOpportunity, "id" | "ice" | "priority"> & { impact: number; confidence: number; ease: number }) => {
    const ice = iceScore(opp.impact, opp.confidence, opp.ease);
    opportunities.push({
      id: `opp-${index++}`,
      ice,
      priority: priorityFromIce(ice),
      title: opp.title,
      detail: opp.detail,
      expectedTrafficGain: opp.expectedTrafficGain,
      estimatedRoiUsd: opp.estimatedRoiUsd,
      source: opp.source,
      kind: opp.kind,
    });
  };

  for (const page of losingTrafficPages(input.pageTrends)) {
    const drop = Math.round(((page.previousClicks - page.clicks) / page.previousClicks) * 100);
    push({
      kind: "losing_traffic",
      title: `Revive ${page.url}`,
      detail: `Traffic down ${drop}% (${page.previousClicks} → ${page.clicks} clicks). Refresh content and rebuild links.`,
      impact: 8,
      confidence: 0.8,
      ease: 6,
      expectedTrafficGain: Math.round(page.previousClicks - page.clicks),
      estimatedRoiUsd: Math.round((page.previousClicks - page.clicks) * 0.02 * acv),
      source: page.url,
    });
  }

  for (const q of losingRankQueries(input.queryTrends)) {
    push({
      kind: "losing_ranking",
      title: `Win back ranking: "${q.query}"`,
      detail: `Position moved ${q.previousPosition} → ${q.position} (${q.clicks} clicks). Strengthen the targeting page.`,
      impact: 7,
      confidence: 0.7,
      ease: 6,
      expectedTrafficGain: Math.round(q.clicks * 0.4),
      estimatedRoiUsd: Math.round(q.clicks * 0.4 * 0.02 * acv),
      source: q.query,
    });
  }

  for (const q of highImpressionLowCtr(input.queryTrends)) {
    const ctr = q.clicks / q.impressions;
    push({
      kind: "low_ctr",
      title: `Fix CTR for "${q.query}"`,
      detail: `${q.impressions} impressions but ${(ctr * 100).toFixed(1)}% CTR. Rewrite title + meta description.`,
      impact: 7,
      confidence: 0.75,
      ease: 8,
      expectedTrafficGain: Math.round(q.impressions * 0.005),
      estimatedRoiUsd: Math.round(q.impressions * 0.005 * 0.02 * acv),
      source: q.query,
    });
  }

  for (const q of stuckKeywords(input.queryTrends)) {
    push({
      kind: "stuck_keyword",
      title: `Push "${q.query}" past position ${STUCK_MIN_POSITION - 1}`,
      detail: `Stuck at position ${q.position}. Add content depth, internal links and schema.`,
      impact: 6,
      confidence: 0.6,
      ease: 6,
      expectedTrafficGain: Math.round(q.impressions * 0.03),
      estimatedRoiUsd: Math.round(q.impressions * 0.03 * 0.02 * acv),
      source: q.query,
    });
  }

  for (const page of decliningClicksPages(input.pageTrends).slice(0, 10)) {
    push({
      kind: "declining_clicks",
      title: `Halt click decline on ${page.url}`,
      detail: `Clicks fell from ${page.previousClicks} to ${page.clicks}. Audit the SERP entry.`,
      impact: 6,
      confidence: 0.65,
      ease: 7,
      expectedTrafficGain: Math.round(page.previousClicks - page.clicks),
      estimatedRoiUsd: Math.round((page.previousClicks - page.clicks) * 0.02 * acv),
      source: page.url,
    });
  }

  for (const url of noInternalLinksPages(input.orphanUrls).slice(0, 10)) {
    push({
      kind: "no_internal_links",
      title: `Link to orphan page ${url}`,
      detail: "This page earns GSC impressions but receives no internal links.",
      impact: 6,
      confidence: 0.8,
      ease: 9,
      expectedTrafficGain: 5,
      estimatedRoiUsd: Math.round(5 * 0.02 * acv),
      source: url,
    });
  }

  for (const page of needsRefreshPages(input.pageTrends, input.contentAges)) {
    push({
      kind: "needs_refresh",
      title: `Refresh stale content on ${page.url}`,
      detail: "Content is older than 90 days and clicks are declining.",
      impact: 6,
      confidence: 0.7,
      ease: 7,
      expectedTrafficGain: Math.round(page.clicks * 0.25),
      estimatedRoiUsd: Math.round(page.clicks * 0.25 * 0.02 * acv),
      source: page.url,
    });
  }

  opportunities.sort((a, b) => b.ice - a.ice || a.id.localeCompare(b.id));
  return opportunities;
}
