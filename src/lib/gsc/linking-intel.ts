/**
 * Linking intelligence — Sprint 5, Phase 7.
 *
 * Combines GSC page data with the internal link graph to find: orphan pages
 * (impressions but no internal links), weak links (high value page with few
 * incoming links), authority flow leaks (hub pages not passing equity) and
 * missing contextual links (keyword gap between GSC queries and the link
 * graph). Each suggestion is ranked with ICE.
 */

import { iceScore, priorityFromIce } from "@/lib/ops/ice";
import type { ActionPriority } from "@/lib/ops/types";

export type LinkingIntelKind =
  | "orphan"
  | "weak_link"
  | "authority_flow"
  | "contextual_gap";

export interface LinkingIntel {
  id: string;
  kind: LinkingIntelKind;
  title: string;
  detail: string;
  fromUrl: string | null;
  toUrl: string;
  ice: number;
  expectedTrafficGain: number; // weekly clicks
  priority: ActionPriority;
}

export interface PageStat {
  url: string;
  clicks: number;
  impressions: number;
  incomingLinks: number;
  /** Title used to derive anchor suggestions. */
  title: string;
}

export interface LinkingIntelInput {
  pages: PageStat[];
  /** Extra URLs known to exist but absent from `pages` (never linked). */
  knownUrls?: string[];
  /** Real backlinks (Ahrefs): url → { count, maxDomainRating }. */
  externalLinks?: Map<string, { count: number; maxDomainRating: number }>;
  acvUsd?: number;
}

/** Pages with traffic but no inbound authority at all (internal nor external). */
export function zeroAuthorityPages(pages: PageStat[], external: Map<string, { count: number }>): PageStat[] {
  return pages
    .filter((p) => p.incomingLinks === 0 && !(external.get(p.url)?.count ?? 0 > 0))
    .sort((a, b) => b.clicks - a.clicks);
}

/** Pages with GSC impressions but zero incoming links. */
export function orphanPages(pages: PageStat[]): PageStat[] {
  return pages
    .filter((p) => p.incomingLinks === 0)
    .sort((a, b) => b.impressions - a.impressions);
}

/** Pages getting clicks with fewer than `minIncoming` links. */
export function weakLinkPages(pages: PageStat[], minIncoming = 1): PageStat[] {
  return pages
    .filter((p) => p.clicks > 0 && p.incomingLinks < minIncoming)
    .sort((a, b) => b.clicks - a.clicks);
}

/** Strongest pages that receive no links from other strong pages. */
export function authorityFlowGaps(pages: PageStat[], top = 5): PageStat[] {
  return pages
    .slice()
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, top)
    .filter((p) => p.incomingLinks === 0);
}

/** Anchor candidate derived from a page title. */
export function anchorFromTitle(title: string): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-zà-ÿ0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (words.length === 0) return title;
  if (words.length === 1) return words[0];
  return words.slice(0, Math.min(4, words.length)).join(" ");
}

export function buildLinkingIntel(input: LinkingIntelInput): LinkingIntel[] {
  const items: LinkingIntel[] = [];
  const external = input.externalLinks ?? new Map<string, { count: number; maxDomainRating: number }>();
  let index = 0;

  const push = (
    kind: LinkingIntelKind,
    fromUrl: string | null,
    toUrl: string,
    detail: string,
    impact: number,
    confidence: number,
    ease: number,
    trafficGain: number
  ) => {
    const ice = iceScore(impact, confidence, ease);
    items.push({
      id: `linking-${index++}`,
      kind,
      fromUrl,
      toUrl,
      detail,
      ice,
      expectedTrafficGain: Math.round(trafficGain),
      priority: priorityFromIce(ice),
      title: `${kind === "orphan" ? "Link" : "Strengthen"} ${toUrl}`,
    });
  };

  for (const page of zeroAuthorityPages(input.pages, external).slice(0, 8)) {
    push(
      "orphan",
      null,
      page.url,
      `Page earns ${page.impressions} impressions but has zero internal links and zero backlinks — the highest-priority link target.`,
      8,
      0.85,
      9,
      page.impressions * 0.04
    );
  }

  for (const page of orphanPages(input.pages).slice(0, 10)) {
    push(
      "orphan",
      null,
      page.url,
      `Page earns ${page.impressions} impressions but no internal links point to it — add contextual links from related articles.`,
      7,
      0.8,
      9,
      page.impressions * 0.03
    );
  }

  for (const page of weakLinkPages(input.pages).slice(0, 8)) {
    push(
      "weak_link",
      null,
      page.url,
      `${page.clicks} clicks but only ${page.incomingLinks} incoming link(s) — add anchors like "${anchorFromTitle(page.title)}".`,
      7,
      0.75,
      8,
      page.clicks * 0.15
    );
  }

  for (const page of authorityFlowGaps(input.pages)) {
    push(
      "authority_flow",
      null,
      page.url,
      `Top traffic page receives no internal links — the hub should point to it to spread authority.`,
      7,
      0.7,
      8,
      page.clicks * 0.1
    );
  }

  for (const page of weakLinkPages(input.pages).slice(0, 8)) {
    push(
      "contextual_gap",
      null,
      page.url,
      `Add contextual links between "${anchorFromTitle(page.title)}" articles and related content — GSC shows demand but the graph is thin.`,
      6,
      0.65,
      9,
      page.clicks * 0.1
    );
  }

  items.sort((a, b) => b.ice - a.ice || a.id.localeCompare(b.id));
  return items;
}
