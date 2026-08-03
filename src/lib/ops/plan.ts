/**
 * Weekly Action Plan — Sprint 3, Phase 2.
 *
 * Automatically generated every Monday: the TOP 10 actions for the week,
 * each with priority, expected impact, estimated effort, ICE score and
 * estimated MRR impact. Built from the content queue, SEO missions and
 * sales plan — pure and deterministic.
 */

import type {
  ActionPlan,
  ContentIdea,
  SalesProspect,
  ScoredAction,
  SeoMission,
} from "@/lib/ops/types";
import type { GrowthSnapshot } from "@/lib/ops/types";
import { estimateMrrImpact, iceScore, priorityFromIce } from "@/lib/ops/ice";

export interface PlanInput {
  snapshot: GrowthSnapshot;
  contentQueue: ContentIdea[];
  seoMissions: SeoMission[];
  salesPlan: SalesProspect[];
  /** Average contract value in USD (for MRR impact estimates). */
  avgContractValueUsd?: number;
  now?: Date;
}

const DEFAULT_ACV_USD = 49;

/** Convert a content idea into a scored action. */
export function contentToAction(idea: ContentIdea, snapshot: GrowthSnapshot): ScoredAction {
  const ice = idea.ice;
  const mrrImpact = estimateMrrImpact(
    Math.round(snapshot.weekly.visits * (idea.trafficPotential / 10) * 0.1),
    snapshot.conversionRate || 0.01,
    DEFAULT_ACV_USD
  );
  return {
    id: `action-content-${idea.id}`,
    kind: "content",
    title: idea.title,
    description: `Publish "${idea.title}" — ${idea.aiCostUsd > 0 ? `~$${idea.aiCostUsd.toFixed(2)} AI cost` : "free"} target.`,
    priority: priorityFromIce(ice),
    impact: idea.trafficPotential,
    ease: idea.difficulty,
    confidence: 0.8,
    ice,
    mrrImpactUsd: mrrImpact,
    source: "content-command-center",
  };
}

/** Convert an SEO mission into a scored action. */
export function seoToAction(mission: SeoMission): ScoredAction {
  return {
    id: `action-seo-${mission.id}`,
    kind: "seo",
    title: mission.title,
    description: mission.detail,
    priority: priorityFromIce(mission.ice),
    impact: mission.impact,
    ease: mission.ease,
    confidence: 0.7,
    ice: mission.ice,
    mrrImpactUsd: Math.round(mission.impact * 3),
    source: "seo-mission-center",
  };
}

/** Convert a prospect into a sales action. */
export function salesToAction(prospect: SalesProspect): ScoredAction {
  const impact = Math.round(prospect.priorityScore / 10);
  const ease = 9;
  const ice = iceScore(impact, prospect.probability * 10, ease);
  return {
    id: `action-sales-${prospect.id}`,
    kind: "sales",
    title: `Contact ${prospect.company}`,
    description: `${prospect.industry ?? "Unknown industry"} · ${prospect.status} · follow up ${prospect.followUpAt}`,
    priority: priorityFromIce(ice),
    impact,
    ease,
    confidence: prospect.probability,
    ice,
    mrrImpactUsd: Math.round(prospect.probability * DEFAULT_ACV_USD * 4),
    source: "sales-command-center",
  };
}

/** Assemble the TOP 10 weekly actions. */
export function buildActionPlan(input: PlanInput, limit = 10): ActionPlan {
  const { snapshot, contentQueue, seoMissions, salesPlan, now } = input;

  const actions: ScoredAction[] = [
    ...contentQueue.slice(0, 4).map((c) => contentToAction(c, snapshot)),
    ...seoMissions.slice(0, 3).map(seoToAction),
    ...salesPlan.slice(0, 3).map(salesToAction),
  ]
    .sort((a, b) => b.ice - a.ice)
    .slice(0, limit);

  const revenueForecastUsd = actions.reduce((acc, a) => acc + a.mrrImpactUsd, 0);
  const date = now ?? new Date();

  return {
    weekStart: snapshot.weekStart,
    weekEnd: snapshot.weekEnd,
    generatedAt: date.toISOString(),
    actions,
    revenueForecastUsd,
  };
}
