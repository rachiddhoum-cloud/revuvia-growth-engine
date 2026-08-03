/**
 * Content opportunity generator — Sprint 5, Phase 6.
 *
 * Uses GSC queries + pages to propose concrete content actions that grow
 * organic traffic: brand-new articles, refreshes, cluster expansion, FAQ
 * blocks for featured snippets, position-0 extraction and long-tail depth.
 */

import { iceScore, priorityFromIce } from "@/lib/ops/ice";
import type { ActionPriority } from "@/lib/ops/types";

export type ContentOppKind =
  | "new_article"
  | "refresh"
  | "expand_cluster"
  | "add_faq"
  | "featured_snippet"
  | "long_tail_depth";

export interface ContentOpportunity {
  id: string;
  kind: ContentOppKind;
  title: string;
  detail: string;
  targetKeyword: string;
  sourceUrl: string | null;
  ice: number;
  expectedTrafficGain: number; // weekly clicks
  estimatedRoiUsd: number; // monthly
  priority: ActionPriority;
}

export interface ContentOppInput {
  queries: { query: string; clicks: number; impressions: number; position: number }[];
  pages: { url: string; clicks: number; position: number }[];
  /** Queries already covered by a page (map query → url). */
  coverage: Record<string, string>;
  acvUsd?: number;
}

const FAQ_QUERY_MIN_IMPRESSIONS = 200;
const SNIPPET_POSITION_RANGE: [number, number] = [4, 8];
const LONG_TAIL_MAX_POSITION = 20;
const LONG_TAIL_MIN_IMPRESSIONS = 50;

/** Queries with zero dedicated content coverage. */
export function uncoveredQueries(input: ContentOppInput): ContentOppInput["queries"] {
  return input.queries.filter((q) => !input.coverage[q.query]);
}

/** Queries ranking 4-8 with strong impressions → featured snippet targets. */
export function snippetTargets(input: ContentOppInput): ContentOppInput["queries"] {
  return input.queries.filter(
    (q) =>
      q.position >= SNIPPET_POSITION_RANGE[0] &&
      q.position <= SNIPPET_POSITION_RANGE[1] &&
      q.impressions >= FAQ_QUERY_MIN_IMPRESSIONS
  );
}

/** Long-tail queries stuck below the first page. */
export function longTailTargets(input: ContentOppInput): ContentOppInput["queries"] {
  return input.queries.filter(
    (q) => q.position >= LONG_TAIL_MAX_POSITION && q.impressions >= LONG_TAIL_MIN_IMPRESSIONS
  );
}

/** Existing pages losing clicks → refresh candidates. */
export function refreshCandidates(
  pages: ContentOppInput["pages"],
  prevPages: ContentOppInput["pages"]
): ContentOppInput["pages"] {
  const prev = new Map(prevPages.map((p) => [p.url, p]));
  return pages
    .filter((p) => prev.has(p.url) && p.clicks < prev.get(p.url)!.clicks)
    .sort((a, b) => a.clicks - b.clicks);
}

/** Cluster expansion: query is covered but sibling long-tails exist. */
export function clusterExpansions(
  input: ContentOppInput,
  baseQuery: string
): { query: string; url: string; clicks: number; impressions: number }[] {
  const covered = new Set(Object.keys(input.coverage));
  return input.queries
    .filter(
      (q) =>
        !covered.has(q.query) &&
        q.query.toLowerCase().includes(baseQuery.toLowerCase()) &&
        q.impressions >= LONG_TAIL_MIN_IMPRESSIONS
    )
    .map((q) => ({ query: q.query, url: input.coverage[baseQuery] ?? "", clicks: q.clicks, impressions: q.impressions }))
    .sort((a, b) => b.impressions - a.impressions);
}

export function buildContentOpportunities(input: ContentOppInput): ContentOpportunity[] {
  const acv = input.acvUsd ?? 100;
  const opps: ContentOpportunity[] = [];
  let index = 0;

  const push = (
    kind: ContentOppKind,
    title: string,
    detail: string,
    keyword: string,
    sourceUrl: string | null,
    impact: number,
    confidence: number,
    ease: number,
    trafficGain: number
  ) => {
    const ice = iceScore(impact, confidence, ease);
    opps.push({
      id: `content-opp-${index++}`,
      kind,
      title,
      detail,
      targetKeyword: keyword,
      sourceUrl,
      ice,
      expectedTrafficGain: Math.round(trafficGain),
      estimatedRoiUsd: Math.round(trafficGain * 0.02 * acv),
      priority: priorityFromIce(ice),
    });
  };

  for (const q of uncoveredQueries(input).sort((a, b) => b.impressions - a.impressions).slice(0, 8)) {
    push(
      "new_article",
      `Write new article targeting "${q.query}"`,
      `${q.impressions} monthly impressions currently lead nowhere.`,
      q.query,
      null,
      8,
      0.7,
      6,
      q.impressions * 0.04
    );
  }

  for (const q of snippetTargets(input).slice(0, 5)) {
    push(
      "featured_snippet",
      `Capture the snippet for "${q.query}"`,
      `Position ${q.position} with ${q.impressions} impressions — add a concise answer block.`,
      q.query,
      input.coverage[q.query] ?? null,
      7,
      0.6,
      8,
      q.impressions * 0.06
    );
  }

  for (const q of snippetTargets(input).slice(0, 5)) {
    push(
      "add_faq",
      `Add FAQ block for "${q.query}"`,
      "Question-shaped long-tails share this intent; answer them in an FAQ section.",
      q.query,
      input.coverage[q.query] ?? null,
      6,
      0.65,
      9,
      q.impressions * 0.02
    );
  }

  for (const q of longTailTargets(input).slice(0, 8)) {
    push(
      "long_tail_depth",
      `Deepen content for "${q.query}"`,
      `Stuck at position ${q.position} — expand the section addressing this long-tail.`,
      q.query,
      input.coverage[q.query] ?? null,
      6,
      0.6,
      7,
      q.impressions * 0.05
    );
  }

  opps.sort((a, b) => b.ice - a.ice || a.id.localeCompare(b.id));
  return opps;
}
