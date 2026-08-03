/**
 * Commercialization OS — Phase 5: daily sales queue engine.
 *
 * Ranks the top N actionable prospects each day (default 20) by opportunity
 * score, expected revenue and stage momentum, and attaches the first touch
 * message plus the follow-up date. Pure and deterministic.
 */

import type { ProspectRow } from "@/types/supabase";
import { followUpDate } from "@/lib/ops/sales";
import { scoreProspectLead } from "@/lib/sales/scoring";
import { buildFirstTouchEmail } from "@/lib/sales/outreach";
import { PIPELINE, stageRank } from "@/lib/sales/pipeline";
import type { DailyQueueItem, DailySalesQueue } from "@/lib/sales/types";

const DEFAULT_ACV_USD = 480;
const EFFORT_MINUTES_PER_TOUCH = 2;

export interface DailyQueueInput {
  prospects: ProspectRow[];
  date: string; // yyyy-mm-dd
  limit?: number;
  now?: Date;
}

const TERMINAL = ["won", "lost", "archived", "closed"];

function acvOf(p: ProspectRow): number {
  return p.acv_usd && p.acv_usd > 0 ? p.acv_usd : DEFAULT_ACV_USD;
}

/** Ranked daily queue of the most valuable prospects to contact today. */
export function buildDailyQueue(input: DailyQueueInput): DailySalesQueue {
  const now = input.now ?? new Date();
  const limit = input.limit ?? 20;

  const items: DailyQueueItem[] = input.prospects
    .filter((p) => !TERMINAL.includes(p.status))
    .map((p) => {
      const score = scoreProspectLead(p);
      const acv = acvOf(p);
      const expectedRevenue = Math.round(score.probability * acv);
      const stage = p.status;
      const stageBoost = stageRank(stage) / 20; // later stages jump the queue
      const combined = score.ice + stageBoost * 100;
      return { p, score, acv, expectedRevenue, combined };
    })
    .sort((a, b) => b.combined - a.combined || b.score.total - a.score.total)
    .slice(0, limit)
    .map(({ p, score, acv, expectedRevenue }, index) => ({
      rank: index + 1,
      prospectId: p.id,
      company: p.company,
      contactName: p.contact_name,
      industry: p.industry,
      stage: p.status,
      score: score.total,
      temperature: score.temperature,
      acvUsd: acv,
      probability: score.probability,
      expectedRevenueUsd: expectedRevenue,
      urgency: score.urgency,
      effortMinutes: EFFORT_MINUTES_PER_TOUCH,
      message: buildFirstTouchEmail(p),
      followUpAt: followUpDate(p.status, now, 7),
    }));

  return {
    date: input.date,
    limit,
    items,
    totalEffortMinutes: items.length * EFFORT_MINUTES_PER_TOUCH,
  };
}

/** Stage probability used by the forecast engines (shared with analytics). */
export function stageProbability(stage: ProspectRow["status"]): number {
  return PIPELINE.probabilities[stage] ?? 0;
}
