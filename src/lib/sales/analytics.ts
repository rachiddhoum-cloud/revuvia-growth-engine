/**
 * Commercialization OS — Phase 7: sales analytics engine.
 *
 * Turns pipeline + messaging + customer data into the numbers a founder
 * needs: funnel health, reply rates, win rate, cycle time, revenue and a
 * deterministic 30/90-day forecast from stage probabilities.
 * Pure and deterministic.
 */

import type { CustomerRow, ProspectRow } from "@/types/supabase";
import { buildFunnel, stageRank } from "@/lib/sales/pipeline";
import { stageProbability } from "@/lib/sales/queue";
import type { MessageRecord, PipelineEvent, SalesAnalytics } from "@/lib/sales/types";

const DEFAULT_ACV_USD = 480;

export interface AnalyticsInput {
  prospects: ProspectRow[];
  customers: CustomerRow[];
  messages: MessageRecord[];
  events: PipelineEvent[];
  asOf?: Date;
}

const METTING_STAGE_RANK = stageRank("demo_scheduled");
const TERMINAL = ["won", "lost", "archived", "closed"];

/** Distinct prospects that replied to at least one message. */
export function replyCount(prospects: ProspectRow[], messages: MessageRecord[]): number {
  const ids = new Set(
    messages.filter((m) => m.status === "replied" || m.repliedAt).map((m) => m.prospectId)
  );
  return [...ids].filter((id) => prospects.some((p) => p.id === id)).length;
}

/** Total sent messages. */
export function sentMessageCount(messages: MessageRecord[]): number {
  return messages.filter((m) => m.status === "sent" && m.sentAt).length;
}

/** Distinct prospects contacted at least once. */
export function contactedCount(prospects: ProspectRow[], messages: MessageRecord[]): number {
  const sentIds = new Set(messages.filter((m) => m.status === "sent" && m.sentAt).map((m) => m.prospectId));
  return prospects.filter((p) => sentIds.has(p.id) || stageRank(p.status) >= stageRank("contacted")).length;
}

/** Full sales analytics snapshot. */
export function buildSalesAnalytics(input: AnalyticsInput): SalesAnalytics {
  const asOf = input.asOf ?? new Date();
  const funnel = buildFunnel(input.prospects, input.events);
  const mrrUsd = input.customers
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + (c.mrr_usd ?? 0), 0);

  const contacted = contactedCount(input.prospects, input.messages);
  const replies = replyCount(input.prospects, input.messages);
  const sentMessages = sentMessageCount(input.messages);

  const meetings = input.prospects.filter(
    (p) => !TERMINAL.includes(p.status) && stageRank(p.status) >= METTING_STAGE_RANK
  ).length;
  const trials = input.prospects.filter((p) => p.status === "trial_started").length;
  const paidCustomers = input.customers.filter((c) => c.status === "paid").length;

  const monthlyExpected = input.prospects
    .filter((p) => !TERMINAL.includes(p.status))
    .reduce((sum, p) => {
      const acv = p.acv_usd && p.acv_usd > 0 ? p.acv_usd : DEFAULT_ACV_USD;
      return sum + stageProbability(p.status) * acv * (1 / 12);
    }, 0);

  return {
    asOf: asOf.toISOString(),
    funnel,
    contacted,
    replies,
    meetings,
    trials,
    paidCustomers,
    revenueUsd: Math.round(mrrUsd * 12), // ARR
    mrrUsd: Math.round(mrrUsd),
    replyRate: sentMessages > 0 ? Math.round((replies / sentMessages) * 1000) / 1000 : 0,
    winRate: funnel.winRate,
    averageCycleDays: funnel.averageCycleDays,
    forecast: {
      next30DaysUsd: Math.round(monthlyExpected),
      next90DaysUsd: Math.round(monthlyExpected * 3),
    },
  };
}
