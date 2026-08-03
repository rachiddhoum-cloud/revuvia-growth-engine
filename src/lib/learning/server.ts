/**
 * Learning engine server orchestrator — Sprint 8, Phases 1-2.
 *
 * `runLearningCycle` loads every historical artifact (content, GSC,
 * social, outreach, backlinks, magnets), detects success patterns and
 * failures, updates the persistent knowledge base (confidence rises for
 * strategies that worked, decays for those that failed) and emits the
 * Monday `learning_insights` report.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase";
import type { Json, ReportType } from "@/types/supabase";
import { todayLocal } from "@/lib/ops/publishing";
import { detectAllPatterns } from "@/lib/learning/patterns";
import { detectAllFailures } from "@/lib/learning/failures";
import { applyObservation, newEntry, outcomeFromUplift } from "@/lib/learning/memory";
import { buildLearningInsights, insightsToMarkdown } from "@/lib/learning/insights";
import type {
  ArticleSample,
  BacklinkSample,
  CtaSample,
  DailySample,
  KeywordSample,
  KnowledgeEntry,
  LearningSamples,
  MagnetSample,
  OutreachSample,
  PageTrendSample,
  PostSample,
  QueryTrendSample,
  StrategyType,
} from "@/lib/learning/types";

async function persistReport(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  type: ReportType,
  periodStart: string,
  periodEnd: string,
  markdown: string,
  data: unknown
): Promise<void> {
  const { error } = await sb.from("reports").upsert(
    {
      owner_id: ownerId,
      type,
      period_start: periodStart,
      period_end: periodEnd,
      markdown,
      html: `<pre>${markdown.replace(/</g, "&lt;")}</pre>`,
      email_html: "",
      pdf_ready: "",
      data: data as unknown as Json,
      status: "generated",
    },
    { onConflict: "owner_id,type,period_start" }
  );
  if (error) throw new Error(`Failed to persist ${type}: ${error.message}`);
}

function ctaTypeOf(cta: unknown): string | null {
  if (typeof cta !== "object" || cta === null) return null;
  const record = cta as Record<string, unknown>;
  if (typeof record.cta_type === "string") return record.cta_type;
  if (typeof record.type === "string") return record.type;
  if (typeof record.text === "string") return record.text;
  return null;
}

/** Load every historical sample needed by the learning engine. */
async function loadLearningSamples(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string
): Promise<LearningSamples> {
  const since = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);

  const [contentRows, pageRows, queryRows, postsRows, dailyRows, outreachRows, backlinkRows, magnetRows] =
    await Promise.all([
      sb
        .from("content_items")
        .select("id,slug,title,kind,cta,lead_magnet_kind,status,published_at")
        .eq("owner_id", ownerId),
      sb
        .from("search_console_pages")
        .select("url,date,clicks,impressions,position")
        .eq("owner_id", ownerId)
        .gte("date", since),
      sb
        .from("search_console_queries")
        .select("query,date,clicks,impressions,ctr,position")
        .eq("owner_id", ownerId)
        .gte("date", since),
      sb
        .from("social_posts")
        .select("platform,published_at,scheduled_for,status,external_url")
        .eq("owner_id", ownerId),
      sb
        .from("daily_metrics")
        .select("metric_date,organic_visits,clicks,conversions,lead_downloads,revenue")
        .eq("owner_id", ownerId)
        .gte("metric_date", since),
      sb
        .from("outreach_tasks")
        .select("page_url,reasoning,status,updated_at")
        .eq("owner_id", ownerId),
      sb
        .from("ahrefs_backlinks")
        .select("url_from,domain_from,domain_rating")
        .eq("owner_id", ownerId),
      sb
        .from("lead_magnet_downloads")
        .select("content_item_id")
        .eq("owner_id", ownerId),
    ]);
  for (const [label, r] of [
    ["content", contentRows],
    ["gsc pages", pageRows],
    ["gsc queries", queryRows],
    ["posts", postsRows],
    ["daily", dailyRows],
    ["outreach", outreachRows],
    ["backlinks", backlinkRows],
    ["magnets", magnetRows],
  ] as const) {
    if (r.error) throw new Error(`Failed to load ${label}: ${r.error.message}`);
  }

  const clicksByUrl = new Map<string, number>();
  const impressionsByUrl = new Map<string, number>();
  for (const row of pageRows.data ?? []) {
    clicksByUrl.set(row.url, (clicksByUrl.get(row.url) ?? 0) + (row.clicks ?? 0));
    impressionsByUrl.set(row.url, (impressionsByUrl.get(row.url) ?? 0) + (row.impressions ?? 0));
  }

  const magnetCounts = new Map<string, number>();
  for (const row of magnetRows.data ?? []) {
    magnetCounts.set(row.content_item_id, (magnetCounts.get(row.content_item_id) ?? 0) + 1);
  }

  const articles: ArticleSample[] = [];
  const ctas: CtaSample[] = [];
  const magnets: MagnetSample[] = [];
  for (const row of contentRows.data ?? []) {
    if (row.status !== "published" || !row.published_at) continue;
    const traffic = clicksByUrl.get(`/blog/${row.slug}`) ?? clicksByUrl.get(`/${row.slug}`) ?? 0;
    const impressions = impressionsByUrl.get(`/blog/${row.slug}`) ?? impressionsByUrl.get(`/${row.slug}`) ?? 0;
    const leads = magnetCounts.get(row.id) ?? 0;
    const cta = ctaTypeOf(row.cta);
    articles.push({
      slug: row.slug,
      title: row.title,
      kind: row.kind,
      ctaType: cta,
      leadMagnetKind: row.lead_magnet_kind,
      publishedAt: row.published_at,
      traffic,
      impressions,
      leads,
    });
    if (cta) ctas.push({ ctaType: cta, traffic, leads });
    if (leads > 0) {
      magnets.push({ kind: row.lead_magnet_kind ?? row.kind, title: row.title, downloads: leads });
    }
  }

  const keywordMap = new Map<string, KeywordSample>();
  for (const row of queryRows.data ?? []) {
    const prev = keywordMap.get(row.query) ?? { query: row.query, clicks: 0, impressions: 0, ctr: 0, position: 0 };
    prev.clicks += row.clicks ?? 0;
    prev.impressions += row.impressions ?? 0;
    prev.position = Math.max(prev.position, row.position ?? 0);
    keywordMap.set(row.query, prev);
  }
  const keywords: KeywordSample[] = [...keywordMap.values()].map((k) => ({
    ...k,
    ctr: k.impressions > 0 ? k.clicks / k.impressions : 0,
  }));

  const posts: PostSample[] = (postsRows.data ?? []).map((p) => ({
    platform: p.platform,
    publishedAt: p.published_at,
    scheduledFor: p.scheduled_for,
    published: p.status === "published" || Boolean(p.external_url),
  }));

  const daily: DailySample[] = (dailyRows.data ?? []).map((d) => ({
    date: d.metric_date,
    organicVisits: d.organic_visits ?? 0,
    clicks: d.clicks ?? 0,
    conversions: d.conversions ?? 0,
    leadDownloads: d.lead_downloads ?? 0,
    revenue: d.revenue ?? 0,
  }));

  const outreach: OutreachSample[] = (outreachRows.data ?? []).map((o) => ({
    pageUrl: o.page_url,
    personalized: o.reasoning.includes("a relationship with"),
    status: o.status,
    updatedAt: o.updated_at,
  }));

  const backlinks: BacklinkSample[] = (backlinkRows.data ?? []).map((b) => ({
    urlFrom: b.url_from,
    domainFrom: b.domain_from,
    domainRating: b.domain_rating,
  }));

  const queries: QueryTrendSample[] = (queryRows.data ?? []).map((q) => ({
    query: q.query,
    date: q.date,
    clicks: q.clicks ?? 0,
    impressions: q.impressions ?? 0,
  }));

  const pages: PageTrendSample[] = (pageRows.data ?? []).map((p) => ({
    url: p.url,
    date: p.date,
    impressions: p.impressions ?? 0,
    position: p.position ?? 0,
  }));

  return { articles, keywords, posts, daily, outreach, backlinks, magnets, ctas, queries, pages };
}

export function toKnowledgeEntry(row: {
  strategy_type: string;
  key: string;
  confidence: number;
  attempts: number;
  successes: number;
  failures: number;
  metrics: Json;
  uplift_pct: number;
  evidence: Json;
  learned_at: string | null;
}): KnowledgeEntry {
  const metrics = (row.metrics ?? {}) as Record<string, number>;
  return {
    strategyType: row.strategy_type as StrategyType,
    key: row.key,
    confidence: Number(row.confidence),
    attempts: row.attempts,
    successes: row.successes,
    failures: row.failures,
    metrics: {
      avgTraffic: metrics.avgTraffic ?? 0,
      avgLeads: metrics.avgLeads ?? 0,
      avgCtr: metrics.avgCtr ?? 0,
      avgEngagement: metrics.avgEngagement ?? 0,
      revenueUsd: metrics.revenueUsd ?? 0,
    },
    upliftPct: Number(row.uplift_pct ?? 0),
    evidence: Array.isArray(row.evidence) ? (row.evidence as string[]) : [],
    learnedAt: row.learned_at,
  };
}

/** Monday (or on-demand) cron: run the full learning cycle. */
export async function runLearningCycle(
  ownerId = "system"
): Promise<{
  ok: boolean;
  patterns: ReturnType<typeof detectAllPatterns>;
  failures: ReturnType<typeof detectAllFailures>;
  insights: ReturnType<typeof buildLearningInsights>;
  knowledge: KnowledgeEntry[];
  artifacts: Record<string, unknown>;
}> {
  const sb = createServiceRoleClient();
  const samples = await loadLearningSamples(sb, ownerId);
  const today = todayLocal();

  const patterns = detectAllPatterns({
    articles: samples.articles,
    keywords: samples.keywords,
    posts: samples.posts,
    daily: samples.daily,
    outreach: samples.outreach,
    backlinks: samples.backlinks,
    magnets: samples.magnets,
    ctas: samples.ctas,
  });
  const failures = detectAllFailures(
    { articles: samples.articles, queries: samples.queries, pages: samples.pages, outreach: samples.outreach },
    today
  );

  const { data: existingRows } = await sb
    .from("knowledge_base")
    .select("strategy_type,key,confidence,attempts,successes,failures,metrics,uplift_pct,evidence,learned_at")
    .eq("owner_id", ownerId);
  if (existingRows === null) throw new Error("Failed to load knowledge base");

  const byKey = new Map<string, KnowledgeEntry>();
  for (const row of existingRows) byKey.set(`${row.strategy_type}:${row.key}`, toKnowledgeEntry(row));

  let updated = 0;
  for (const pattern of patterns) {
    const compositeKey = `${pattern.strategyType}:${pattern.key}`;
    const entry = byKey.get(compositeKey) ?? newEntry(pattern.strategyType, pattern.key);
    const updatedEntry = applyObservation(entry, {
      metrics: {
        avgTraffic: pattern.avgTraffic,
        avgLeads: pattern.avgLeads,
        avgCtr: pattern.avgCtr,
        avgEngagement: pattern.successRate,
        revenueUsd: Math.round(pattern.avgTraffic * 0.1),
      },
      outcome: outcomeFromUplift(pattern.upliftPct),
      evidence: pattern.evidence[0],
      upliftPct: pattern.upliftPct,
    });
    const { error } = await sb.from("knowledge_base").upsert(
      {
        owner_id: ownerId,
        strategy_type: updatedEntry.strategyType,
        key: updatedEntry.key,
        confidence: updatedEntry.confidence,
        attempts: updatedEntry.attempts,
        successes: updatedEntry.successes,
        failures: updatedEntry.failures,
        metrics: updatedEntry.metrics as unknown as Json,
        uplift_pct: updatedEntry.upliftPct,
        evidence: updatedEntry.evidence as unknown as Json,
        learned_at: updatedEntry.learnedAt,
      },
      { onConflict: "owner_id,strategy_type,key" }
    );
    if (error) throw new Error(`Failed to persist knowledge: ${error.message}`);
    byKey.set(compositeKey, updatedEntry);
    updated++;
  }

  const knowledge = [...byKey.values()];
  const insights = buildLearningInsights({ weekStart: today, patterns, failures });
  await persistReport(sb, ownerId, "learning_insights", today, today, insightsToMarkdown(insights), {
    insights,
    patterns,
    failures,
    knowledge,
    generatedAt: today,
  });

  return {
    ok: true,
    patterns,
    failures,
    insights,
    knowledge,
    artifacts: {
      patterns: patterns.length,
      failures: failures.length,
      knowledgeEntries: knowledge.length,
      knowledgeUpdated: updated,
      learned: insights.learned.length,
      stopDoing: insights.stopDoing.length,
      doMore: insights.doMore.length,
    },
  };
}
