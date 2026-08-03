/**
 * Failure detection — Sprint 8, Phase 5.
 *
 * Detects low-ROI content, dead keywords, pages that never rank and stale
 * outreach campaigns, and attaches a corrective action to each. Pure and
 * deterministic; `asOf` anchors every date comparison.
 */

import type { ArticleSample, Failure, OutreachSample, PageTrendSample, QueryTrendSample } from "@/lib/learning/types";

export type { PageTrendSample, QueryTrendSample } from "@/lib/learning/types";

/** ISO date `days` before `asOf` (string comparison safe). */
export function daysAgo(asOf: string, days: number): string {
  const [y, m, d] = asOf.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) - days * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Content published 14+ days ago with no traffic at all. */
export function lowRoiContent(articles: ArticleSample[], asOf: string, thresholdTraffic = 0): Failure[] {
  const cutoff = daysAgo(asOf, 14);
  const oldCutoff = daysAgo(asOf, 30);
  const failures: Failure[] = [];
  for (const a of articles) {
    if (!a.publishedAt || a.publishedAt.slice(0, 10) > cutoff || a.traffic > thresholdTraffic) continue;
    failures.push({
      kind: "low_roi_content",
      target: `/${a.slug}`,
      detail: `"${a.title}" was published ${a.publishedAt.slice(0, 10)} and earned zero clicks in the last 28 days.`,
      severity: a.publishedAt.slice(0, 10) < oldCutoff ? "high" : "medium",
      correctiveAction: "Refresh the content, merge it into a hub page, or unpublish and 301 to a related article.",
    });
  }
  return failures.sort((a, b) => a.target.localeCompare(b.target));
}

/**
 * Dead keywords: queries whose impressions collapsed by > 50% between the
 * first and second half of the observed window, with almost no clicks left.
 */
export function deadKeywords(queries: QueryTrendSample[], asOf: string): Failure[] {
  const failures: Failure[] = [];
  const cutoff = daysAgo(asOf, 28);
  const within = queries.filter((q) => q.date >= cutoff);
  const byQuery = new Map<string, QueryTrendSample[]>();
  for (const q of within) {
    const list = byQuery.get(q.query) ?? [];
    list.push(q);
    byQuery.set(q.query, list);
  }
  for (const [query, days] of byQuery) {
    if (days.length < 4) continue;
    const sorted = days.slice().sort((a, b) => a.date.localeCompare(b.date));
    const mid = Math.floor(sorted.length / 2);
    const first = sorted.slice(0, mid).reduce((a, b) => a + b.impressions, 0);
    const second = sorted.slice(mid).reduce((a, b) => a + b.impressions, 0);
    const clicks2 = sorted.slice(mid).reduce((a, b) => a + b.clicks, 0);
    if (first >= 50 && second < first * 0.5 && clicks2 < 3) {
      failures.push({
        kind: "dead_keyword",
        target: query,
        detail: `"${query}" dropped from ${first} to ${second} impressions (${Math.round((1 - second / first) * 100)}% loss) with ${clicks2} clicks left.`,
        severity: second === 0 ? "high" : "medium",
        correctiveAction: "Stop bidding on this query: rework the targeting or fold it into a broader cluster.",
      });
    }
  }
  return failures.sort((a, b) => a.target.localeCompare(b.target));
}

/** Pages that get impressions but never reach a ranking position. */
export function neverRankingPages(pages: PageTrendSample[], asOf: string, minImpressions = 100): Failure[] {
  const cutoff = daysAgo(asOf, 28);
  const within = pages.filter((p) => p.date >= cutoff);
  const byUrl = new Map<string, PageTrendSample[]>();
  for (const p of within) {
    const list = byUrl.get(p.url) ?? [];
    list.push(p);
    byUrl.set(p.url, list);
  }
  const failures: Failure[] = [];
  for (const [url, days] of byUrl) {
    const impressions = days.reduce((a, b) => a + b.impressions, 0);
    const minPosition = Math.min(...days.map((d) => d.position));
    if (impressions < minImpressions || minPosition <= 20) continue;
    failures.push({
      kind: "never_ranking",
      target: url,
      detail: `${url} earned ${impressions} impressions but never climbed above position ${Math.round(minPosition)}.`,
      severity: impressions >= 1000 ? "high" : "medium",
      correctiveAction: "Rewrite the title and meta description, add internal links, or consolidate with a stronger page.",
    });
  }
  return failures.sort((a, b) => a.target.localeCompare(b.target));
}

/**
 * Stale outreach: queued/in_progress tasks untouched for 14+ days, or
 * 'done' campaigns that never produced a reply-window signal within 21 days.
 */
export function staleOutreach(tasks: OutreachSample[], asOf: string, staleDays = 14): Failure[] {
  const failures: Failure[] = [];
  for (const t of tasks) {
    if (!t.updatedAt) continue;
    const updated = t.updatedAt.slice(0, 10);
    if (t.status === "queued" || t.status === "in_progress") {
      if (updated <= daysAgo(asOf, staleDays)) {
        failures.push({
          kind: "poor_reply_outreach",
          target: t.pageUrl,
          detail: `Outreach for ${t.pageUrl} has not progressed since ${updated} (${t.personalized ? "personalized" : "generic"} draft).`,
          severity: "medium",
          correctiveAction: "Change the angle or personalization, or drop the task and re-queue it with a new draft.",
        });
      }
    } else if (t.status === "done" && updated <= daysAgo(asOf, 21)) {
      failures.push({
        kind: "poor_reply_outreach",
        target: t.pageUrl,
        detail: `Campaign for ${t.pageUrl} completed ${updated} with no reply tracked.`,
        severity: "low",
        correctiveAction: "Send a short follow-up with a different value proposition before closing the thread.",
      });
    }
  }
  return failures.sort((a, b) => a.target.localeCompare(b.target));
}

/** All failure detectors at once. */
export function detectAllFailures(
  samples: {
    articles: ArticleSample[];
    queries: QueryTrendSample[];
    pages: PageTrendSample[];
    outreach: OutreachSample[];
  },
  asOf: string
): Failure[] {
  return [
    ...lowRoiContent(samples.articles, asOf),
    ...deadKeywords(samples.queries, asOf),
    ...neverRankingPages(samples.pages, asOf),
    ...staleOutreach(samples.outreach, asOf),
  ];
}
