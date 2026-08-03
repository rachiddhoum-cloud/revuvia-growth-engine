/**
 * Commercialization OS — Phase 9: CEO sales report engine.
 *
 * The one-page sales briefing: top open deals, stalled risk, forecast and
 * concrete next actions. Pure and deterministic.
 */

import type { ProspectRow } from "@/types/supabase";
import { stageProbability } from "@/lib/sales/queue";
import type { MessageRecord, PipelineEvent, SalesAnalytics } from "@/lib/sales/types";

const DEFAULT_ACV_USD = 480;
const STALL_FOLLOW_UP_DAYS = 7;
const STALL_SILENCE_DAYS = 14;

export interface CeoReportInput {
  analytics: SalesAnalytics;
  prospects: ProspectRow[];
  messages: MessageRecord[];
  events: PipelineEvent[];
  asOf?: Date;
}

const OPEN = ["new", "new_lead", "contacted", "replied", "waiting", "interested", "demo", "demo_scheduled", "trial_started", "negotiation"];

function acvOf(p: ProspectRow): number {
  return p.acv_usd && p.acv_usd > 0 ? p.acv_usd : DEFAULT_ACV_USD;
}

/** Open deals ranked by expected value (probability × ACV). */
export function topOpenDeals(prospects: ProspectRow[], limit = 5): Array<{ prospect: ProspectRow; valueUsd: number; probability: number }> {
  return prospects
    .filter((p) => OPEN.includes(p.status))
    .map((p) => ({
      prospect: p,
      valueUsd: Math.round(stageProbability(p.status) * acvOf(p)),
      probability: stageProbability(p.status),
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, limit);
}

/** Prospects lost in the last 30 days (from pipeline events). */
export function recentlyLost(prospects: ProspectRow[], events: PipelineEvent[], asOf: Date): ProspectRow[] {
  const cutoff = asOf.getTime() - 30 * 86_400_000;
  const lostIds = new Set(
    events.filter((e) => e.stage === "lost" && new Date(e.at).getTime() >= cutoff).map((e) => e.prospectId)
  );
  return prospects.filter((p) => lostIds.has(p.id) || (p.status === "lost" && p.updated_at >= new Date(cutoff).toISOString()));
}

/** Human-readable risks that could sink the forecast. */
export function biggestRisks(prospects: ProspectRow[], asOf: Date): string[] {
  const risks: string[] = [];
  const overdueFollowUps = prospects.filter((p) => {
    if (!OPEN.includes(p.status)) return false;
    if (!p.follow_up_at) return false;
    return new Date(p.follow_up_at).getTime() < asOf.getTime() - STALL_FOLLOW_UP_DAYS * 86_400_000;
  });
  if (overdueFollowUps.length > 0) {
    risks.push(`${overdueFollowUps.length} open deal(s) have a follow-up overdue by 7+ days (${overdueFollowUps.slice(0, 3).map((p) => p.company).join(", ")}${overdueFollowUps.length > 3 ? "..." : ""})`);
  }
  const goingCold = prospects.filter((p) => {
    if (!["replied", "contacted", "waiting"].includes(p.status)) return false;
    if (!p.last_interaction_at) return false;
    return new Date(p.last_interaction_at).getTime() < asOf.getTime() - STALL_SILENCE_DAYS * 86_400_000;
  });
  if (goingCold.length > 0) {
    risks.push(`${goingCold.length} replied/contacted prospect(s) went silent for 14+ days`);
  }
  return risks;
}

/** Build the CEO one-page sales report. */
export function buildCeoSalesReport(input: CeoReportInput) {
  const asOf = input.asOf ?? new Date();
  const deals = topOpenDeals(input.prospects, 5);
  const lost = recentlyLost(input.prospects, input.events, asOf);
  const risks = biggestRisks(input.prospects, asOf);
  const highestValue = deals.length > 0 ? deals[0].valueUsd : 0;

  const recommendations: string[] = [];
  const a = input.analytics;
  if (a.contacted > Math.max(a.replies * 4, 4)) {
    recommendations.push("Reply rate is low vs contacts — send the follow-up sequence and personalize the first touch");
  }
  if (a.meetings > a.trials) {
    recommendations.push(`${a.meetings - a.trials} demo(s) have not converted to trials — follow up within 48h after the demo`);
  }
  const negotiation = input.prospects.filter((p) => p.status === "negotiation").length;
  if (negotiation > 0) {
    recommendations.push(`${negotiation} deal(s) in negotiation — push to close this week`);
  }
  if (a.forecast.next30DaysUsd < a.mrrUsd) {
    recommendations.push("Forecast is below current MRR — add 10+ new prospects to the pipeline");
  }
  if (risks.length > 0) {
    recommendations.push("Clear stalled deals before opening new conversations");
  }
  if (recommendations.length === 0) {
    recommendations.push("Pipeline is healthy — keep the daily queue running and book demos for interested prospects");
  }

  const markdown = [
    `# CEO Sales Report — ${asOf.toISOString().slice(0, 10)}`,
    "",
    `- MRR: $${a.mrrUsd} | ARR: $${a.revenueUsd} | Paid customers: ${a.paidCustomers}`,
    `- Forecast: $${a.forecast.next30DaysUsd} (30d) / $${a.forecast.next90DaysUsd} (90d)`,
    `- Reply rate: ${Math.round(a.replyRate * 100)}% | Win rate: ${Math.round(a.winRate * 100)}% | Cycle: ${a.averageCycleDays}d`,
    "",
    "## Top opportunities",
    ...deals.map((d) => `- ${d.prospect.company} (${d.prospect.status}): $${d.valueUsd} expected`),
    "",
    "## Risks",
    ...(risks.length > 0 ? risks.map((r) => `- ${r}`) : ["- None"]),
    "",
    "## Recommendations",
    ...recommendations.map((r) => `- ${r}`),
  ].join("\n");

  return {
    asOf: asOf.toISOString(),
    topOpportunities: deals.map((d) => ({
      company: d.prospect.company,
      stage: d.prospect.status,
      valueUsd: d.valueUsd,
      probability: d.probability,
      reason: `${d.prospect.lead_temperature ?? "unknown"} lead in ${d.prospect.status}`,
    })),
    lostCount: lost.length,
    biggestRisks: risks,
    highestValue,
    recommendations,
    markdown,
  };
}

export type CeoSalesReportResult = ReturnType<typeof buildCeoSalesReport>;
