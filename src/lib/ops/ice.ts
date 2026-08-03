/**
 * ICE scoring helpers — Sprint 3.
 *
 * ICE = Impact × Confidence × Ease (all 0-10, Ease 10 = trivial).
 * Priority buckets are derived from the ICE score for consistent labeling
 * across the action plan, SEO missions and content queue.
 */

import { clamp } from "@/lib/utils";
import type { ActionPriority } from "@/lib/ops/types";

export interface IceParts {
  impact: number;
  confidence: number;
  ease: number;
}

export function iceScore(impact: number, confidence: number, ease: number): number {
  const i = clamp(impact, 0, 10);
  const c = clamp(confidence, 0, 10);
  const e = clamp(ease, 0, 10);
  return Math.round(i * c * e * 10) / 10;
}

/** P0 >= 400, P1 >= 250, else P2 (out of a 1000 max ICE). */
export function priorityFromIce(ice: number): ActionPriority {
  if (ice >= 400) return "P0";
  if (ice >= 250) return "P1";
  return "P2";
}

export function formatIce(ice: number): string {
  return ice.toFixed(1);
}

/** Estimated MRR impact from weekly visits, conversion and ACV. */
export function estimateMrrImpact(
  weeklyVisits: number,
  conversionRate: number,
  avgContractValueUsd: number,
  attributionShare = 0.3
): number {
  const conversions = weeklyVisits * conversionRate;
  return Math.round(conversions * avgContractValueUsd * attributionShare);
}
