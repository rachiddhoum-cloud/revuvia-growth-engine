/**
 * GSC server loader — Sprint 5, Phase 9.
 *
 * Builds the RecommendationInput and HealthMetrics from the synced tables
 * (queries, pages, daily metrics, internal links, content items). Pure
 * mapping helpers + a server wrapper. Contained errors degrade to an
 * empty-but-valid input so the weekly report never crashes.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { toLocalIso, addDays } from "@/lib/gsc/core";
import type { HealthMetrics } from "@/lib/gsc/health-score";
import type { PageTrend, QueryTrend } from "@/lib/gsc/opportunities";
import type { RecommendationInput } from "@/lib/gsc/recommendations";
import type { ContentItemRow } from "@/lib/analytics/aggregate";

export interface LoadedGscData {
  pageTrends: PageTrend[];
  queryTrends: QueryTrend[];
  healthMetrics: HealthMetrics;
  orphanUrls: string[];
  contentAges: { url: string; createdAt: string }[];
  internalLinkCoveragePct: number;
  /** Real backlinks (Ahrefs): url_to → { count, maxDomainRating }. */
  backlinks: Map<string, { count: number; maxDomainRating: number }>;
  /** Active internal links count per target url. */
  internalLinkCounts: Map<string, number>;
}

/** 7-day click totals per page, compared to the previous 7 days. */
export function buildPageTrends(
  current: { url: string; clicks: number; impressions: number; ctr: number; position: number }[],
  previous: { url: string; clicks: number }[]
): PageTrend[] {
  const prev = new Map(previous.map((p) => [p.url, p.clicks]));
  const byUrl = new Map<string, PageTrend>();
  for (const row of current) {
    byUrl.set(row.url, {
      url: row.url,
      previousClicks: prev.get(row.url) ?? 0,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    });
  }
  return Array.from(byUrl.values());
}

/** Query trend with previous-position comparison (best effort). */
export function buildQueryTrends(
  current: { query: string; clicks: number; impressions: number; position: number }[],
  previous: { query: string; position: number }[]
): QueryTrend[] {
  const prevPos = new Map(previous.map((q) => [q.query, q.position]));
  const byQuery = new Map<string, QueryTrend>();
  for (const row of current) {
    const prev = prevPos.get(row.query);
    byQuery.set(row.query, {
      query: row.query,
      previousClicks: 0,
      clicks: row.clicks,
      impressions: row.impressions,
      position: row.position,
      previousPosition: prev ?? 0,
    });
  }
  return Array.from(byQuery.values());
}

export async function loadGscData(ownerId = "system"): Promise<LoadedGscData> {
  const sb = createServiceRoleClient();
  const today = toLocalIso(new Date());
  const currentStart = addDays(today, -6);
  const previousStart = addDays(today, -13);
  const previousEnd = addDays(today, -7);

  const empty: LoadedGscData = {
    pageTrends: [],
    queryTrends: [],
    healthMetrics: {
      current: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        avgPosition: 0,
        pagesWithClicks: 0,
        queriesWithClicks: 0,
        topQueryShare: 0,
        publishedLast30d: 0,
        refreshedLast30d: 0,
      },
      previous: {
        clicks: 0,
        impressions: 0,
        ctr: 0,
        avgPosition: 0,
        pagesWithClicks: 0,
        queriesWithClicks: 0,
        topQueryShare: 0,
        publishedLast30d: 0,
        refreshedLast30d: 0,
      },
      internalLinkCoveragePct: 0,
    },
    orphanUrls: [],
    contentAges: [],
    internalLinkCoveragePct: 0,
    backlinks: new Map(),
    internalLinkCounts: new Map(),
  };

  try {
    const [pagesCur, pagesPrev, queriesCur, queriesPrev, items, backlinksRes] = await Promise.all([
      sb
        .from("search_console_pages")
        .select("url,clicks,impressions,ctr,position")
        .eq("owner_id", ownerId)
        .gte("date", currentStart),
      sb
        .from("search_console_pages")
        .select("url,clicks")
        .eq("owner_id", ownerId)
        .gte("date", previousStart)
        .lte("date", previousEnd),
      sb
        .from("search_console_queries")
        .select("query,clicks,impressions,position")
        .eq("owner_id", ownerId)
        .gte("date", currentStart),
      sb
        .from("search_console_queries")
        .select("query,position")
        .eq("owner_id", ownerId)
        .gte("date", previousStart)
        .lte("date", previousEnd),
      sb
        .from("content_items")
        .select("id,slug,excerpt,scheduled_for,published_at,created_at,updated_at")
        .eq("owner_id", ownerId)
        .limit(500),
      sb
        .from("ahrefs_backlinks")
        .select("url_to,domain_rating")
        .eq("owner_id", ownerId)
        .limit(20000),
    ]);

    const backlinks = new Map<string, { count: number; maxDomainRating: number }>();
    for (const row of backlinksRes.data ?? []) {
      const current = backlinks.get(row.url_to) ?? { count: 0, maxDomainRating: 0 };
      current.count += 1;
      current.maxDomainRating = Math.max(current.maxDomainRating, row.domain_rating);
      backlinks.set(row.url_to, current);
    }

    const itemIds = (items.data ?? []).map((i) => i.id);
    const links =
      itemIds.length === 0
        ? { data: [] }
        : await sb
            .from("internal_links")
            .select("target_url,status")
            .in("content_item_id", itemIds);

    const internalCount = new Map<string, number>();
    for (const link of (links.data ?? []).filter((l) => l.status === "active")) {
      internalCount.set(link.target_url, (internalCount.get(link.target_url) ?? 0) + 1);
    }

    const pageTrends = buildPageTrends(pagesCur.data ?? [], pagesPrev.data ?? []);
    const queryTrends = buildQueryTrends(queriesCur.data ?? [], queriesPrev.data ?? []);

    const currentClicks = pageTrends.reduce((a, p) => a + p.clicks, 0);
    const currentImpr = pageTrends.reduce((a, p) => a + p.impressions, 0);
    const previousClicks = (pagesPrev.data ?? []).reduce((a, p) => a + p.clicks, 0);
    const previousImpr = pageTrends.reduce((a, p) => a + p.previousClicks, 0);

    const activeTargets = new Set(
      (links.data ?? []).filter((l) => l.status === "active").map((l) => l.target_url)
    );
    const urlsWithTraffic = new Set(pageTrends.map((p) => p.url));
    const orphanUrls = Array.from(urlsWithTraffic).filter((u) => !activeTargets.has(u));
    const coveragePct =
      urlsWithTraffic.size === 0
        ? 0
        : Math.round(
            ((urlsWithTraffic.size - orphanUrls.length) / urlsWithTraffic.size) * 100
          );

    const topQuery = queryTrends.slice().sort((a, b) => b.clicks - a.clicks)[0];
    const queriesWithClicks = queryTrends.filter((q) => q.clicks > 0).length;
    const avgPos =
      pageTrends.filter((p) => p.position > 0).length === 0
        ? 0
        : pageTrends
            .filter((p) => p.position > 0)
            .reduce((a, p) => a + p.position, 0) /
          pageTrends.filter((p) => p.position > 0).length;

    const published = (items.data ?? []).filter(
      (i) => new Date(i.created_at).getTime() > Date.now() - 30 * 86_400_000
    ).length;
    const refreshed = (items.data ?? []).filter(
      (i) =>
        i.updated_at &&
        new Date(i.updated_at).getTime() > Date.now() - 30 * 86_400_000
    ).length;

    return {
      pageTrends,
      queryTrends,
      orphanUrls,
      backlinks,
      internalLinkCounts: internalCount,
      contentAges: (items.data ?? [])
        .filter((i) => i.slug)
        .map((i) => ({
          url: `/${i.slug}`,
          createdAt: i.created_at,
        })),
      internalLinkCoveragePct: coveragePct,
      healthMetrics: {
        current: {
          clicks: currentClicks,
          impressions: currentImpr,
          ctr: currentImpr > 0 ? currentClicks / currentImpr : 0,
          avgPosition: avgPos,
          pagesWithClicks: pageTrends.filter((p) => p.clicks > 0).length,
          queriesWithClicks,
          topQueryShare: currentClicks > 0 ? (topQuery?.clicks ?? 0) / currentClicks : 0,
          publishedLast30d: published,
          refreshedLast30d: refreshed,
        },
        previous: {
          clicks: previousClicks,
          impressions: previousImpr,
          ctr: previousImpr > 0 ? previousClicks / previousImpr : 0,
          avgPosition: 0,
          pagesWithClicks: 0,
          queriesWithClicks: 0,
          topQueryShare: 0,
          publishedLast30d: 0,
          refreshedLast30d: 0,
        },
        internalLinkCoveragePct: coveragePct,
      },
    };
  } catch {
    return empty;
  }
}

/** Build the full RecommendationInput for the CEO report (server). */
export async function loadRecommendationInput(ownerId = "system"): Promise<RecommendationInput> {
  const data = await loadGscData(ownerId);
  const { buildSeoOpportunities } = await import("@/lib/gsc/opportunities");
  const { buildContentOpportunities } = await import("@/lib/gsc/content-opps");
  const { buildLinkingIntel } = await import("@/lib/gsc/linking-intel");

  const opportunities = buildSeoOpportunities({
    pageTrends: data.pageTrends,
    queryTrends: data.queryTrends,
    orphanUrls: data.orphanUrls,
    contentAges: data.contentAges,
  });

  const contentOpps = buildContentOpportunities({
    queries: data.queryTrends.map((q) => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      position: q.position,
    })),
    pages: data.pageTrends.map((p) => ({ url: p.url, clicks: p.clicks, position: p.position })),
    coverage: {},
  });

  const linkingIntel = buildLinkingIntel({
    pages: data.pageTrends.map((p) => ({
      url: p.url,
      clicks: p.clicks,
      impressions: p.impressions,
      incomingLinks: data.internalLinkCounts.get(p.url) ?? 0,
      title: p.url,
    })),
    externalLinks: data.backlinks,
  });

  return {
    pageTrends: data.pageTrends,
    queryTrends: data.queryTrends,
    healthMetrics: data.healthMetrics,
    opportunities,
    contentOpps,
    linkingIntel,
    conversionRate: 0.01,
    acvUsd: 100,
    forecastWeeks: 12,
  };
}

export type { ContentItemRow };
