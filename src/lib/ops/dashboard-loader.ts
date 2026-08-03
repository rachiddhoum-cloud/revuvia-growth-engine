/**
 * CEO Dashboard loader (server-only).
 *
 * Builds the full executive view: the growth snapshot + the latest weekly
 * action plan (persisted as a `reports` row of type `action_plan`). Degrades
 * gracefully when data isn't wired up yet.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";
import { loadGrowthSnapshot } from "@/lib/ops/load";
import type { GrowthSnapshot, GrowthScore } from "@/lib/ops/types";
import type { ActionPlan } from "@/lib/ops/types";
import type { WeeklyMetrics } from "@/lib/ops/types";

export interface ScorePoint {
  date: string;
  total: number;
}

export interface CeoDashboardModel {
  snapshot: GrowthSnapshot;
  latestPlan: ActionPlan | null;
  latestScore: GrowthScore | null;
  scoreHistory: ScorePoint[];
}

const EMPTY_METRICS: WeeklyMetrics = {
  visits: 0,
  clicks: 0,
  impressions: 0,
  conversions: 0,
  leads: 0,
  signups: 0,
  aiRuns: 0,
  aiCostUsd: 0,
  publishedCount: 0,
};

export async function loadCeoDashboard(ownerId?: string): Promise<CeoDashboardModel> {
  const input = await loadGrowthSnapshot(ownerId, 7);

  try {
    const sb = await createServerClient();
    type ReportResult = { data: unknown; error: unknown };
    const [planRes, scoreRes, historyRes] = (await Promise.all([
      sb
        .from("reports")
        .select("period_start,period_end,data,generated_at")
        .eq("type", "action_plan")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("reports")
        .select("data")
        .eq("type", "growth_score")
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("reports")
        .select("period_start,data")
        .eq("type", "growth_score")
        .order("generated_at", { ascending: false })
        .limit(8),
    ])) as unknown as [ReportResult, ReportResult, ReportResult];

    const { data, error } = planRes;
    const scoreRows = scoreRes;
    const historyRows = historyRes;

    const row = data as unknown as {
      period_start: string;
      period_end: string;
      data: Record<string, unknown>;
      generated_at: string;
    } | null;

    let latestScore: GrowthScore | null = null;
    if (!scoreRows.error && scoreRows.data && typeof scoreRows.data === "object") {
      latestScore = scoreRows.data as unknown as GrowthScore;
    }

    const scoreHistory: ScorePoint[] = [];
    if (!historyRows.error && Array.isArray(historyRows.data)) {
      for (const r of historyRows.data as unknown as { period_start: string; data: unknown }[]) {
        const d = r.data as Record<string, unknown>;
        if (typeof d?.total === "number" && typeof r.period_start === "string") {
          scoreHistory.push({ date: r.period_start, total: d.total });
        }
      }
      scoreHistory.reverse();
    }

    if (!error && row && row.data && typeof row.data === "object" && "actions" in row.data) {
      return {
        snapshot: buildGrowthSnapshot(input),
        latestPlan: row.data as unknown as ActionPlan,
        latestScore,
        scoreHistory,
      };
    }  } catch (error) {
    console.error("[ops] failed to load latest action plan", error);
  }

  return {
    snapshot: buildGrowthSnapshot(input),
    latestPlan: null,
    latestScore: null,
    scoreHistory: [],
  };
}

export { EMPTY_METRICS };
