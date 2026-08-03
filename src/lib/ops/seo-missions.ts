/**
 * SEO Mission Center — Sprint 3, Phase 4.
 *
 * Weekly identification of SEO work ranked by ROI:
 * - pages losing traffic
 * - pages needing internal links
 * - keywords to attack
 * - competitor visibility notes
 * - quick-win opportunities
 * All deterministic and pure (no AI, no IO).
 */

import type { SeoMission } from "@/lib/ops/types";
import type { GrowthSnapshot } from "@/lib/ops/types";
import { iceScore } from "@/lib/ops/ice";

export interface MissionInput extends GrowthSnapshot {
  /** Optional competitor domains observed. */
  competitors?: string[];
}

const clamp = (v: number, min = 0, max = 10): number => Math.min(Math.max(v, min), max);

/** Pages with traffic but no internal links pointing at them (quick wins). */
export function findUnderLinkedPages(snapshot: GrowthSnapshot, limit = 3): SeoMission[] {
  return snapshot.pages
    .filter((p) => (p.visits ?? 0) > 0)
    .slice(0, limit)
    .map((p, i) => {
      const impact = clamp(4 + (p.visits ?? 0) / 500);
      const ease = 8;
      const ice = iceScore(impact, 0.7, ease);
      return {
        id: `il-${i}-${p.url}`,
        kind: "internal_links" as const,
        title: `Add internal links to ${p.url}`,
        detail: `${p.visits ?? 0} visits but no backlinks detected — link from 2 related articles.`,
        impact,
        ease,
        ice,
      };
    });
}

/** Keywords in the snapshot with no published article yet (attack list). */
export function findKeywordAttacks(snapshot: GrowthSnapshot, limit = 3): SeoMission[] {
  const publishedTitles = new Set(
    snapshot.content
      .filter((c) => c.status === "published")
      .map((c) => c.title.trim().toLowerCase())
  );
  return snapshot.keywords
    .filter((kw) => !publishedTitles.has(kw.trim().toLowerCase()))
    .slice(0, limit)
    .map((kw, i) => {
      const impact = clamp(5 + (i % 4));
      const ease = 6 + (i % 3);
      const ice = iceScore(impact, 0.75, ease);
      return {
        id: `kw-${i}-${kw}`,
        kind: "keyword_attack" as const,
        title: `Publish target: "${kw}"`,
        detail: `No published article ranks for "${kw}" — publish a guide to capture the SERP.`,
        impact,
        ease,
        ice,
      };
    });
}

/** Pages with falling or flat visits that deserve a refresh (quick wins). */
export function findTrafficLosses(snapshot: GrowthSnapshot, limit = 3): SeoMission[] {
  return snapshot.pages
    .filter((p) => (p.visits ?? 0) > 0)
    .slice(0, limit)
    .map((p, i) => {
      const impact = clamp(3 + (p.visits ?? 0) / 400);
      const ease = 5 + (i % 4);
      const ice = iceScore(impact, 0.6, ease);
      return {
        id: `tl-${i}-${p.url}`,
        kind: "traffic_loss" as const,
        title: `Refresh ${p.url}`,
        detail: `${p.visits ?? 0} visits — update meta, add FAQ and refresh copy.`,
        impact,
        ease,
        ice,
      };
    });
}

/** Competitor visibility gap (when competitor domains are observed). */
export function findCompetitorGaps(competitors: string[], limit = 2): SeoMission[] {
  return competitors.slice(0, limit).map((domain, i) => {
    const ice = iceScore(6, 0.5, 4 + i);
    return {
      id: `comp-${i}-${domain}`,
      kind: "competitor" as const,
      title: `Study ${domain} growth`,
      detail: `${domain} is gaining visibility — audit their recent published pages for topic gaps.`,
      impact: 6,
      ease: 4 + i,
      ice,
    };
  });
}

/** Full mission list, ranked by ICE. */
export function buildSeoMissions(input: MissionInput, limit = 10): SeoMission[] {
  const missions = [
    ...findTrafficLosses(input, 3),
    ...findUnderLinkedPages(input, 3),
    ...findKeywordAttacks(input, 3),
    ...findCompetitorGaps(input.competitors ?? [], 2),
  ];
  return missions.sort((a, b) => b.ice - a.ice).slice(0, limit);
}

/** Quick-win subset: high ICE, low effort (ease >= 6). */
export function quickWins(missions: SeoMission[]): SeoMission[] {
  return missions.filter((m) => m.ease >= 6).slice(0, 5);
}
