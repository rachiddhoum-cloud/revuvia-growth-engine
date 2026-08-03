/**
 * Commercialization OS — Phase 4: sales pipeline engine.
 *
 * Canonical 8-stage pipeline (New Lead → Contacted → Waiting → Interested →
 * Demo Scheduled → Trial Started → Negotiation → Won/Lost/Archived) plus the
 * legacy statuses, with explicit transition rules, funnel health metrics and
 * stage-duration (cycle time) computation from pipeline events.
 * Pure and deterministic.
 */

import type { ProspectRow, ProspectStatus } from "@/types/supabase";
import type { FunnelSummary, PipelineDefinition, PipelineEvent } from "@/lib/sales/types";

const DEFAULT_ACV_USD = 480;

export const PIPELINE: PipelineDefinition = {
  stages: [
    "new_lead",
    "contacted",
    "waiting",
    "interested",
    "demo_scheduled",
    "trial_started",
    "negotiation",
    "won",
    "lost",
    "archived",
  ],
  transitions: {
    new: ["new_lead", "contacted", "lost", "archived"],
    new_lead: ["contacted", "waiting", "lost", "archived"],
    contacted: ["waiting", "interested", "lost", "archived"],
    replied: ["waiting", "interested", "demo_scheduled", "lost", "archived"],
    waiting: ["interested", "contacted", "lost", "archived"],
    interested: ["demo_scheduled", "waiting", "lost", "archived"],
    demo_scheduled: ["trial_started", "negotiation", "lost", "archived"],
    demo: ["trial_started", "negotiation", "lost", "archived"],
    trial_started: ["negotiation", "won", "lost", "archived"],
    negotiation: ["won", "lost", "archived"],
    closed: ["won", "archived"],
    won: ["archived"],
    lost: ["new_lead", "archived"],
    archived: [],
  },
  probabilities: {
    new: 0.02,
    new_lead: 0.05,
    contacted: 0.1,
    replied: 0.2,
    waiting: 0.15,
    interested: 0.25,
    demo_scheduled: 0.3,
    demo: 0.3,
    trial_started: 0.45,
    negotiation: 0.6,
    won: 1,
    closed: 0.9,
    lost: 0,
    archived: 0,
  },
};

/** True when a stage can move directly to another stage. */
export function canTransition(from: ProspectStatus, to: ProspectStatus): boolean {
  return PIPELINE.transitions[from]?.includes(to) ?? false;
}

/** Error message when a transition is impossible, null otherwise. */
export function transitionStage(from: ProspectStatus, to: ProspectStatus): string | null {
  if (from === to) return `Prospect is already in ${from}`;
  if (!canTransition(from, to)) return `Prospect cannot move from ${from} to ${to}`;
  return null;
}

/** Build a pipeline event for the history log. */
export function stageEvent(
  prospectId: string,
  stage: ProspectStatus,
  note: string | null,
  at: string
): PipelineEvent {
  return { prospectId, stage, note, at };
}

const TERMINAL: ProspectStatus[] = ["won", "lost", "archived", "closed"];

/** Average days from first pipeline event to the win event. */
export function averageCycleDays(events: PipelineEvent[]): number {
  const wins = new Map<string, { first: number; won: number }>();
  for (const e of events) {
    const t = new Date(e.at).getTime();
    if (!Number.isFinite(t)) continue;
    const entry = wins.get(e.prospectId) ?? { first: t, won: Number.POSITIVE_INFINITY };
    if (t < entry.first) entry.first = t;
    if (e.stage === "won" || e.stage === "closed") entry.won = Math.min(entry.won, t);
    wins.set(e.prospectId, entry);
  }
  let total = 0;
  let count = 0;
  for (const { first, won } of wins.values()) {
    if (!Number.isFinite(won)) continue;
    const days = (won - first) / 86_400_000;
    if (days >= 0) {
      total += days;
      count += 1;
    }
  }
  return count === 0 ? 0 : Math.round((total / count) * 10) / 10;
}

/** Pipeline health: funnel totals, open value, win rate, cycle time. */
export function buildFunnel(prospects: ProspectRow[], events: PipelineEvent[] = []): FunnelSummary {
  const totals: Record<ProspectStatus, number> = Object.fromEntries(
    PIPELINE.stages.map((s) => [s, 0])
  ) as Record<ProspectStatus, number>;

  let openDeals = 0;
  let totalValueUsd = 0;
  let won = 0;
  let lost = 0;

  for (const p of prospects) {
    totals[p.status] = (totals[p.status] ?? 0) + 1;
    if (TERMINAL.includes(p.status)) {
      if (p.status === "won" || p.status === "closed") won += 1;
      if (p.status === "lost") lost += 1;
      continue;
    }
    const prob = PIPELINE.probabilities[p.status] ?? 0;
    if (prob > 0) {
      openDeals += 1;
      const acv = p.acv_usd && p.acv_usd > 0 ? p.acv_usd : DEFAULT_ACV_USD;
      totalValueUsd += prob * acv;
    }
  }

  return {
    totals,
    openDeals,
    totalValueUsd: Math.round(totalValueUsd),
    winRate: won + lost === 0 ? 0 : Math.round((won / (won + lost)) * 100) / 100,
    averageCycleDays: averageCycleDays(events),
  };
}

/** Ordered stage index used by the queue engine. */
export function stageRank(stage: ProspectStatus): number {
  const idx = PIPELINE.stages.indexOf(stage);
  return idx === -1 ? 0 : idx;
}
