/**
 * Content Command Center — Sprint 3, Phase 5.
 *
 * Ranks content opportunities by traffic potential, business value,
 * difficulty, revenue impact and estimated AI cost. Produces a production
 * queue sorted by ICE. Deterministic and pure.
 */

import type { ContentIdea } from "@/lib/ops/types";
import type { GrowthSnapshot } from "@/lib/ops/types";
import { iceScore, priorityFromIce } from "@/lib/ops/ice";

export interface ContentCandidate {
  id: string;
  title: string;
  keyword: string;
  kind: ContentIdea["kind"];
  trafficPotential: number; // 1-10
  businessValue: number; // 1-10
  difficulty: number; // 1-10 (10 = easy)
  revenueImpact: number; // 1-10
  estimatedWords: number;
}

/** Average cost per 1k words across providers/models (USD). */
export const AI_COST_PER_1K_WORDS = 0.02;

export function estimateAiCost(candidate: Pick<ContentCandidate, "estimatedWords">): number {
  return Math.round((candidate.estimatedWords / 1000) * AI_COST_PER_1K_WORDS * 100) / 100;
}

/** Default candidate pool derived from the snapshot keywords when none supplied. */
export function defaultCandidates(snapshot: GrowthSnapshot): ContentCandidate[] {
  return snapshot.keywords.slice(0, 6).map((kw, i) => ({
    id: `content-${i}-${kw}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
    title: `Guide: ${kw}`,
    keyword: kw,
    kind: "article" as const,
    trafficPotential: 5 + ((i * 7) % 5),
    businessValue: 4 + ((i * 3) % 5),
    difficulty: 6 + ((i * 2) % 4),
    revenueImpact: 3 + ((i * 5) % 6),
    estimatedWords: 1400,
  }));
}

/** Rank content candidates into a production queue (highest ICE first). */
export function rankContentQueue(
  candidates: ContentCandidate[],
  snapshot: GrowthSnapshot
): ContentIdea[] {
  return candidates
    .map((c) => {
      const ease = c.difficulty; // higher difficulty number = easier
      // Confidence in traffic potential is higher when the engine is already
      // driving weekly traffic (past performance validates demand).
      const confidence = 0.7 + Math.min(0.2, snapshot.weekly.visits / 10_000);
      const ice = iceScore(c.trafficPotential, confidence, ease);
      const scored: ContentIdea = {
        id: c.id,
        title: c.title,
        kind: c.kind,
        keyword: c.keyword,
        trafficPotential: c.trafficPotential,
        businessValue: c.businessValue,
        difficulty: c.difficulty,
        revenueImpact: c.revenueImpact,
        aiCostUsd: estimateAiCost(c),
        ice,
      };
      return { scored, priority: priorityFromIce(ice) };
    })
    .sort((a, b) => b.scored.ice - a.scored.ice)
    .map(({ scored }) => scored);
}

/** Top N queue with the estimated AI budget for the batch. */
export function buildContentQueue(
  candidates: ContentCandidate[],
  snapshot: GrowthSnapshot,
  limit = 10
): { queue: ContentIdea[]; totalAiCostUsd: number } {
  const queue = rankContentQueue(candidates, snapshot).slice(0, limit);
  return {
    queue,
    totalAiCostUsd: Math.round(queue.reduce((acc, c) => acc + c.aiCostUsd, 0) * 100) / 100,
  };
}
