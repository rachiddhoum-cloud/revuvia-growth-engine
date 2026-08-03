/**
 * Sales Command Center — Sprint 3, Phase 3.
 *
 * Weekly prospect scoring with priority, industry, contact status, last
 * interaction, recommended message, follow-up date and expected probability.
 * Simple execution — no CRM complexity. Deterministic and pure.
 */

import type { ProspectRow } from "@/types/supabase";
import type { SalesProspect } from "@/lib/ops/types";

export interface SalesInput {
  prospects: ProspectRow[];
  /** Follow-up window in days (default 7). */
  followUpDays?: number;
  /** Reference date (defaults to now). */
  now?: Date;
}

const INDUSTRY_MESSAGES: Record<string, string> = {
  restaurant: "Automate your review collection with a smart QR code — reply when I can send the one-pager.",
  cafe: "Your reviews are your best salespeople. Our QR code gets you 3x more Google reviews — want a quick demo?",
  salon: "Turn every appointment into a 5-star review automatically. 5 minutes to set up — interested?",
  dentist: "Patient reviews drive new bookings. See how clinics collect reviews on autopilot with Revuvia.",
  generic: "Revuvia grows local businesses with automated review collection and content. Want a 10-minute walkthrough?",
};

const STATUS_WEIGHT: Record<ProspectRow["status"], number> = {
  new: 0,
  new_lead: 0,
  contacted: 10,
  replied: 25,
  waiting: 25,
  interested: 30,
  demo_scheduled: 40,
  demo: 40,
  trial_started: 45,
  negotiation: 55,
  won: 60,
  closed: 50,
  lost: 0,
  archived: 0,
};

export function industryMessage(industry: string | null): string {
  if (!industry) return INDUSTRY_MESSAGES.generic;
  const key = industry.trim().toLowerCase();
  if (key.includes("restaurant") || key.includes("cafe") || key.includes("coffee")) {
    return key.includes("cafe") || key.includes("coffee")
      ? INDUSTRY_MESSAGES.cafe
      : INDUSTRY_MESSAGES.restaurant;
  }
  if (key.includes("salon") || key.includes("beauty") || key.includes("spa")) return INDUSTRY_MESSAGES.salon;
  if (key.includes("dent") || key.includes("clinic") || key.includes("medical")) return INDUSTRY_MESSAGES.dentist;
  return INDUSTRY_MESSAGES.generic;
}

/** 0-100 priority: status momentum + recency of last contact + freshness. */
export function scoreProspect(p: ProspectRow, now: Date): number {
  let score = STATUS_WEIGHT[p.status] ?? 0;
  const lastContact = p.last_interaction_at ? new Date(p.last_interaction_at).getTime() : null;
  if (lastContact) {
    const daysSince = Math.floor((now.getTime() - lastContact) / 86_400_000);
    // Touched recently = warm; untouched for a while = follow up.
    score += Math.max(0, 20 - daysSince) + Math.min(daysSince, 15);
  } else {
    score += 10; // never contacted — new pipeline
  }
  return Math.min(100, score + (p.priority_score ?? 0));
}

/** Expected win probability 0-1 from status + priority. */
export function expectedProbability(p: ProspectRow, priorityScore: number): number {
  const base = STATUS_WEIGHT[p.status] / 100;
  return Math.min(0.95, Math.round((base + (priorityScore / 100) * 0.2) * 100) / 100);
}

/** Add follow-up date (iso date) based on status. */
export function followUpDate(status: ProspectRow["status"], from: Date, days: number): string {
  const active =
    status === "replied" ||
    status === "demo" ||
    status === "demo_scheduled" ||
    status === "interested" ||
    status === "waiting";
  const hot = status === "trial_started" || status === "negotiation" || status === "won";
  const done = status === "closed" || status === "lost" || status === "archived";
  const offset = active ? Math.max(days, 3) : hot ? Math.max(days, 2) : done ? 0 : days;
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/** Score all prospects and return the weekly execution list (sorted). */
export function buildSalesPlan(input: SalesInput, limit = 10): SalesProspect[] {
  const now = input.now ?? new Date();
  const days = input.followUpDays ?? 7;

  return input.prospects
    .map((p) => {
      const priorityScore = scoreProspect(p, now);
      return {
        id: p.id,
        company: p.company,
        industry: p.industry,
        contactName: p.contact_name,
        email: p.email,
        status: p.status,
        priorityScore,
        lastInteractionAt: p.last_interaction_at,
        recommendedMessage: p.recommended_message ?? industryMessage(p.industry),
        followUpAt: followUpDate(p.status, now, days),
        probability: expectedProbability(p, priorityScore),
      };
    })
    .filter((p) => !["lost", "closed", "won", "archived"].includes(p.status))
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, limit);
}
