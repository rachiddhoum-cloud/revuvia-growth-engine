/**
 * Commercialization OS — Phase 8: sales learning engine.
 *
 * Detects what works in outbound sales from the message log and pipeline:
 * winning templates, channels, industries and cadence steps — measured as
 * reply / win-rate uplifts against the global baseline. Observations feed
 * the shared knowledge_base (strategy types sales_message, sales_industry,
 * sales_channel, sales_cadence) via the learning memory model.
 * Pure and deterministic.
 */

import type { ProspectRow } from "@/types/supabase";
import { outcomeFromUplift } from "@/lib/learning/memory";
import type { KnowledgeStrategyType } from "@/types/supabase";
import type { MessageRecord } from "@/lib/sales/types";

export interface SalesObservation {
  strategyType: Extract<
    KnowledgeStrategyType,
    "sales_message" | "sales_industry" | "sales_channel" | "sales_cadence"
  >;
  key: string;
  /** Samples observed (attempts / deals). */
  attempts: number;
  successRate: number; // 0-1
  /** Uplift vs the global baseline, in % (negative = worse). */
  upliftPct: number;
  outcome: ReturnType<typeof outcomeFromUplift>;
  evidence: string;
}

const MIN_SAMPLES = 2;

function groupedReplyRates(
  messages: MessageRecord[],
  groupOf: (m: MessageRecord) => string | null
): Map<string, { attempts: number; replies: number }> {
  const groups = new Map<string, { attempts: number; replies: number }>();
  for (const m of messages) {
    const key = groupOf(m);
    if (!key) continue;
    const g = groups.get(key) ?? { attempts: 0, replies: 0 };
    g.attempts += 1;
    if (m.status === "replied" || m.repliedAt) g.replies += 1;
    groups.set(key, g);
  }
  return groups;
}

/** Template keys and channels that get replies above the baseline. */
export function detectMessagePatterns(
  messages: MessageRecord[],
  byTemplate: (m: MessageRecord) => string | null = (m) => m.templateKey
): SalesObservation[] {
  const observations: SalesObservation[] = [];
  const groups = groupedReplyRates(messages, byTemplate);
  const attempts = [...groups.values()].reduce((s, g) => s + g.attempts, 0);
  const replies = [...groups.values()].reduce((s, g) => s + g.replies, 0);
  if (attempts === 0) return observations;
  const baseline = replies / attempts;

  for (const [key, g] of groups) {
    if (g.attempts < MIN_SAMPLES || key === null) continue;
    const rate = g.replies / g.attempts;
    const uplift = baseline > 0 ? Math.round(((rate - baseline) / baseline) * 100) : rate > 0 ? 100 : 0;
    observations.push({
      strategyType: "sales_message",
      key,
      attempts: g.attempts,
      successRate: rate,
      upliftPct: uplift,
      outcome: outcomeFromUplift(uplift),
      evidence: `${key} (${g.replies}/${g.attempts} replies)`,
    });
  }
  return observations;
}

/** Channels that get replies above the baseline. */
export function detectChannelPatterns(messages: MessageRecord[]): SalesObservation[] {
  const observations: SalesObservation[] = [];
  const groups = groupedReplyRates(messages, (m) => m.channel);
  const attempts = [...groups.values()].reduce((s, g) => s + g.attempts, 0);
  const replies = [...groups.values()].reduce((s, g) => s + g.replies, 0);
  if (attempts === 0) return observations;
  const baseline = replies / attempts;

  for (const [key, g] of groups) {
    if (g.attempts < MIN_SAMPLES) continue;
    const rate = g.replies / g.attempts;
    const uplift = baseline > 0 ? Math.round(((rate - baseline) / baseline) * 100) : rate > 0 ? 100 : 0;
    observations.push({
      strategyType: "sales_channel",
      key,
      attempts: g.attempts,
      successRate: rate,
      upliftPct: uplift,
      outcome: outcomeFromUplift(uplift),
      evidence: `${key} (${g.replies}/${g.attempts} replies)`,
    });
  }
  return observations;
}

/** Industries that close above the baseline. */
export function detectIndustryPatterns(prospects: ProspectRow[]): SalesObservation[] {
  const observations: SalesObservation[] = [];
  const byIndustry = new Map<string, { deals: number; wins: number }>();
  let deals = 0;
  let wins = 0;

  for (const p of prospects) {
    if (!["won", "closed", "lost"].includes(p.status)) continue;
    const industry = p.industry ?? "unknown";
    const g = byIndustry.get(industry) ?? { deals: 0, wins: 0 };
    g.deals += 1;
    if (p.status === "won" || p.status === "closed") g.wins += 1;
    byIndustry.set(industry, g);
    deals += 1;
    if (p.status === "won" || p.status === "closed") wins += 1;
  }
  if (deals === 0) return observations;
  const baseline = wins / deals;

  for (const [industry, g] of byIndustry) {
    if (g.deals < MIN_SAMPLES) continue;
    const rate = g.wins / g.deals;
    const uplift = baseline > 0 ? Math.round(((rate - baseline) / baseline) * 100) : rate > 0 ? 100 : 0;
    observations.push({
      strategyType: "sales_industry",
      key: industry,
      attempts: g.deals,
      successRate: rate,
      upliftPct: uplift,
      outcome: outcomeFromUplift(uplift),
      evidence: `${industry} (${g.wins}/${g.deals} deals won)`,
    });
  }
  return observations;
}

/** Cadence step (touch number) that converts replies into wins. */
export function detectCadencePatterns(
  prospects: ProspectRow[],
  messages: MessageRecord[]
): SalesObservation[] {
  const observations: SalesObservation[] = [];
  const touchCount = new Map<string, number>();
  for (const m of messages) {
    if (m.status !== "sent" || !m.sentAt) continue;
    touchCount.set(m.prospectId, (touchCount.get(m.prospectId) ?? 0) + 1);
  }
  const byTouch = new Map<number, { prospects: number; won: number }>();
  let total = 0;
  let won = 0;
  for (const p of prospects) {
    if (!["won", "closed", "lost"].includes(p.status)) continue;
    const touch = Math.min(touchCount.get(p.id) ?? 0, 5);
    const g = byTouch.get(touch) ?? { prospects: 0, won: 0 };
    g.prospects += 1;
    if (p.status === "won" || p.status === "closed") g.won += 1;
    byTouch.set(touch, g);
    total += 1;
    if (p.status === "won" || p.status === "closed") won += 1;
  }
  if (total === 0) return observations;
  const baseline = won / total;

  for (const [touch, g] of byTouch) {
    if (g.prospects < MIN_SAMPLES) continue;
    const rate = g.won / g.prospects;
    const uplift = baseline > 0 ? Math.round(((rate - baseline) / baseline) * 100) : rate > 0 ? 100 : 0;
    observations.push({
      strategyType: "sales_cadence",
      key: `${touch} touches`,
      attempts: g.prospects,
      successRate: rate,
      upliftPct: uplift,
      outcome: outcomeFromUplift(uplift),
      evidence: `${touch} touch(es) → ${g.won}/${g.prospects} wins`,
    });
  }
  return observations;
}

/** All sales observations in one pass. */
export function detectSalesPatterns(prospects: ProspectRow[], messages: MessageRecord[]): SalesObservation[] {
  return [
    ...detectMessagePatterns(messages),
    ...detectChannelPatterns(messages),
    ...detectIndustryPatterns(prospects),
    ...detectCadencePatterns(prospects, messages),
  ];
}
