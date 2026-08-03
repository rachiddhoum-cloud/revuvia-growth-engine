/**
 * Success patterns — Sprint 8, Phase 4.
 *
 * Automatically detects winning article structures, keyword clusters,
 * publication times, CTAs, lead magnets, channels, outreach patterns and
 * backlink sources by comparing group averages against the overall
 * baseline. Deterministic; only groups with enough samples qualify.
 */

import type {
  ArticleSample,
  BacklinkSample,
  CtaSample,
  DailySample,
  KeywordSample,
  MagnetSample,
  OutreachSample,
  PostSample,
  SuccessPattern,
} from "@/lib/learning/types";

function uplift(avg: number, baseline: number): number {
  if (baseline <= 0) return 0;
  return Math.round(((avg - baseline) / baseline) * 100);
}

function buildPattern(
  strategyType: SuccessPattern["strategyType"],
  key: string,
  samples: number,
  metricValues: number[],
  baseline: number,
  evidence: string[],
  successRate: number
): SuccessPattern {
  const avg = metricValues.length > 0 ? metricValues.reduce((a, b) => a + b, 0) / metricValues.length : 0;
  return {
    strategyType,
    key,
    samples,
    successRate: Math.round(successRate * 1000) / 1000,
    avgTraffic: Math.round(avg),
    avgLeads: Math.round(avg * 0.1),
    avgCtr: Math.round((avg / Math.max(baseline, 1)) * 10000) / 10000,
    upliftPct: uplift(avg, baseline),
    evidence,
  };
}

/** Structural features derived from an article title + kind. */
export function articleFeatures(article: ArticleSample): { strategyType: "article_structure" | "content_type"; key: string }[] {
  const features: { strategyType: "article_structure" | "content_type"; key: string }[] = [];
  if (/\d/.test(article.title)) features.push({ strategyType: "article_structure", key: "title_has_number" });
  const lower = article.title.toLowerCase();
  if (/\bhow to\b/.test(lower) || /\bguide\b/.test(lower)) features.push({ strategyType: "article_structure", key: "title_how_to_or_guide" });
  const len = article.title.length;
  if (len < 40) features.push({ strategyType: "article_structure", key: "title_short" });
  else if (len <= 60) features.push({ strategyType: "article_structure", key: "title_medium" });
  else features.push({ strategyType: "article_structure", key: "title_long" });
  features.push({ strategyType: "content_type", key: article.kind });
  return features;
}

function groupPatterns<T>(
  strategyType: SuccessPattern["strategyType"],
  items: T[],
  keyOf: (item: T) => string,
  metric: (item: T) => number,
  evidence: (item: T) => string,
  minSamples: number
): SuccessPattern[] {
  if (items.length === 0) return [];
  const baseline = items.reduce((a, b) => a + metric(b), 0) / items.length;
  const groups = new Map<string, { values: number[]; evidence: string[]; count: number }>();
  for (const item of items) {
    const key = keyOf(item);
    const g = groups.get(key) ?? { values: [], evidence: [], count: 0 };
    g.values.push(metric(item));
    g.evidence.push(evidence(item));
    g.count++;
    groups.set(key, g);
  }
  const patterns: SuccessPattern[] = [];
  for (const [key, g] of groups) {
    if (g.count < minSamples) continue;
    const successRate = g.values.filter((v) => v >= baseline).length / g.values.length;
    patterns.push(
      buildPattern(strategyType, key, g.count, g.values, baseline, g.evidence.slice(0, 5), successRate)
    );
  }
  return patterns.sort((a, b) => b.upliftPct - a.upliftPct || a.key.localeCompare(b.key));
}

/** Winning article structures + content types. */
export function articleStructurePatterns(articles: ArticleSample[], minSamples = 2): SuccessPattern[] {
  const items = articles.map((a) => ({ article: a, metric: a.traffic }));
  if (items.length === 0) return [];
  const baseline = items.reduce((a, b) => a + b.metric, 0) / items.length;
  const groups = new Map<string, { values: number[]; evidence: string[]; count: number }>();
  for (const { article, metric } of items) {
    for (const feature of articleFeatures(article)) {
      const key = `${feature.strategyType}:${feature.key}`;
      const g = groups.get(key) ?? { values: [], evidence: [], count: 0 };
      g.values.push(metric);
      g.evidence.push(article.slug);
      g.count++;
      groups.set(key, g);
    }
  }
  const patterns: SuccessPattern[] = [];
  for (const [key, g] of groups) {
    if (g.count < minSamples) continue;
    const successRate = g.values.filter((v) => v >= baseline).length / g.values.length;
    const [strategyType, featureKey] = key.split(":");
    patterns.push(
      buildPattern(
        strategyType as "article_structure" | "content_type",
        featureKey,
        g.count,
        g.values,
        baseline,
        g.evidence.slice(0, 5),
        successRate
      )
    );
  }
  return patterns.sort((a, b) => b.upliftPct - a.upliftPct || a.key.localeCompare(b.key));
}

/** Winning keyword clusters: group by the leading token of the query. */
export function keywordClusterPatterns(keywords: KeywordSample[], minSamples = 2): SuccessPattern[] {
  const leadToken = (q: string) => {
    const token = q.toLowerCase().trim().split(/\s+/)[0];
    return token.length >= 2 ? token : "other";
  };
  return groupPatterns<KeywordSample>("keyword_cluster", keywords, (k) => leadToken(k.query), (k) => k.clicks, (k) => k.query, minSamples);
}

/** Winning publication times: weekdays from daily metrics, hours from posts. */
export function publicationTimePatterns(daily: DailySample[], posts: PostSample[], minSamples = 2): SuccessPattern[] {
  const weekdays = daily.map((d) => ({
    key: `weekday:${weekdayName(d.date)}`,
    metric: d.revenue,
    evidence: d.date,
  }));
  const patterns = groupPatterns(
    "publication_time",
    weekdays,
    (w) => w.key,
    (w) => w.metric,
    (w) => w.evidence,
    minSamples
  );
  const hourGroups = new Map<string, { attempts: number; published: number }>();
  for (const p of posts) {
    const at = p.publishedAt ?? p.scheduledFor;
    if (!at) continue;
    const hour = `${new Date(at).getUTCHours().toString().padStart(2, "0")}h`;
    const g = hourGroups.get(hour) ?? { attempts: 0, published: 0 };
    g.attempts++;
    if (p.published) g.published++;
    hourGroups.set(hour, g);
  }
  for (const [hour, g] of hourGroups) {
    if (g.attempts < minSamples) continue;
    patterns.push({
      strategyType: "publication_time",
      key: `hour:${hour}`,
      samples: g.attempts,
      successRate: Math.round((g.published / g.attempts) * 1000) / 1000,
      avgTraffic: 0,
      avgLeads: 0,
      avgCtr: 0,
      upliftPct: g.published > 0 ? Math.round((g.published / Math.max(g.attempts, 1)) * 100) : 0,
      evidence: [`${hour} posts`],
    });
  }
  return patterns.sort((a, b) => b.upliftPct - a.upliftPct || a.key.localeCompare(b.key));
}

export function weekdayName(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "?";
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
}

/** Winning acquisition channels. */
export function channelPatterns(posts: PostSample[], minSamples = 2): SuccessPattern[] {
  return groupPatterns(
    "channel",
    posts.filter((p) => p.publishedAt || p.scheduledFor),
    (p) => p.platform,
    (p) => (p.published ? 1 : 0),
    (p) => p.platform,
    minSamples
  );
}

/** Winning outreach patterns: personalized vs generic drafts. */
export function outreachPatterns(tasks: OutreachSample[], minSamples = 2): SuccessPattern[] {
  return groupPatterns(
    "outreach_pattern",
    tasks,
    (t) => (t.personalized ? "personalized" : "generic"),
    (t) => (t.status === "done" ? 1 : 0),
    (t) => t.pageUrl,
    minSamples
  );
}

/** Winning backlink sources by average domain rating. */
export function backlinkSourcePatterns(backlinks: BacklinkSample[], minSamples = 1): SuccessPattern[] {
  return groupPatterns(
    "backlink_source",
    backlinks,
    (b) => b.domainFrom,
    (b) => b.domainRating,
    (b) => b.urlFrom,
    minSamples
  );
}

/** Winning lead magnets by kind. */
export function leadMagnetPatterns(magnets: MagnetSample[], minSamples = 2): SuccessPattern[] {
  return groupPatterns(
    "lead_magnet",
    magnets,
    (m) => m.kind,
    (m) => m.downloads,
    (m) => m.title,
    minSamples
  );
}

/** Winning CTAs by type. */
export function ctaPatterns(ctas: CtaSample[], minSamples = 2): SuccessPattern[] {
  return groupPatterns("cta", ctas, (c) => c.ctaType, (c) => c.traffic, (c) => c.ctaType, minSamples);
}

/** All patterns at once (ordered by uplift, winner first). */
export function detectAllPatterns(
  samples: {
    articles: ArticleSample[];
    keywords: KeywordSample[];
    posts: PostSample[];
    daily: DailySample[];
    outreach: OutreachSample[];
    backlinks: BacklinkSample[];
    magnets: MagnetSample[];
    ctas: CtaSample[];
  },
  minSamples = 2
): SuccessPattern[] {
  return [
    ...articleStructurePatterns(samples.articles, minSamples),
    ...keywordClusterPatterns(samples.keywords, minSamples),
    ...publicationTimePatterns(samples.daily, samples.posts, minSamples),
    ...channelPatterns(samples.posts, minSamples),
    ...outreachPatterns(samples.outreach, minSamples),
    ...backlinkSourcePatterns(samples.backlinks, 1),
    ...leadMagnetPatterns(samples.magnets, minSamples),
    ...ctaPatterns(samples.ctas, minSamples),
  ].sort((a, b) => b.upliftPct - a.upliftPct || a.strategyType.localeCompare(b.strategyType) || a.key.localeCompare(b.key));
}
