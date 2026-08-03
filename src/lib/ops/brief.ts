/**
 * Founder Daily Brief — Sprint 3, Phase 6.
 *
 * Every morning: today's priorities, new opportunities, urgent issues and the
 * four KPI lines (marketing / sales / traffic / revenue). Target: < 3 minutes
 * to read. Pure and deterministic.
 */

import type { ActionPlan, DailyBrief } from "@/lib/ops/types";
import type { GrowthSnapshot } from "@/lib/ops/types";

export interface BriefInput {
  snapshot: GrowthSnapshot;
  actionPlan: ActionPlan;
  now?: Date;
}

/** Top P0/P1 actions from the plan become today's priorities. */
export function todaysPriorities(actionPlan: ActionPlan, limit = 3): string[] {
  return actionPlan.actions
    .filter((a) => a.priority === "P0" || a.priority === "P1")
    .slice(0, limit)
    .map((a) => a.title);
}

/** New opportunities: quick wins + high-confidence content ideas. */
export function newOpportunities(actionPlan: ActionPlan, snapshot: GrowthSnapshot, limit = 3): string[] {
  const sales = actionPlan.actions.filter((a) => a.kind === "sales" && a.confidence >= 0.6);
  const content = actionPlan.actions.filter((a) => a.kind === "content" && a.ease >= 6);
  const items = [
    ...content.map((a) => `Content: ${a.title}`),
    ...sales.map((a) => `Prospect: ${a.title}`),
  ];
  return items.slice(0, limit).length > 0
    ? items.slice(0, limit)
    : ["No new opportunities detected — publish or prospect to create some."];
}

/** Urgent issues: churn, AI cost spikes, quality regressions. */
export function urgentIssues(snapshot: GrowthSnapshot): string[] {
  const issues: string[] = [];
  if (snapshot.customers.churned > 0) {
    issues.push(`${snapshot.customers.churned} customer(s) churned this week — reach out.`);
  }
  if (snapshot.weekly.aiCostUsd > 1) {
    issues.push(`AI spend $${snapshot.weekly.aiCostUsd.toFixed(2)} this week — review generation volume.`);
  }
  if (snapshot.qualityAverage > 0 && snapshot.qualityAverage < 75) {
    issues.push(`Average content quality ${snapshot.qualityAverage.toFixed(0)}/100 — raise the bar before publishing.`);
  }
  if (issues.length === 0) issues.push("No urgent issues — keep executing.");
  return issues;
}

export function buildDailyBrief(input: BriefInput): DailyBrief {
  const date = (input.now ?? new Date()).toISOString().slice(0, 10);
  const { snapshot, actionPlan } = input;

  return {
    date,
    priorities: todaysPriorities(actionPlan),
    opportunities: newOpportunities(actionPlan, snapshot),
    urgentIssues: urgentIssues(snapshot),
    marketingKpi: `${snapshot.weekly.publishedCount} published · ${snapshot.weekly.leads} leads`,
    salesKpi: `${snapshot.customers.trial} trials · ${snapshot.customers.paid} paid · ${actionPlan.actions.filter((a) => a.kind === "sales").length} contacts queued`,
    trafficKpi: `${snapshot.weekly.visits} visits · ${snapshot.weekly.clicks} clicks · ~${snapshot.estimatedSeoTraffic} est. SEO`,
    revenueKpi: `$${snapshot.customers.mrrUsd.toFixed(2)} MRR · +$${actionPlan.revenueForecastUsd} forecast`,
    readMinutes: 3,
  };
}

/** Markdown rendering of the brief (kept separate, still pure). */
export function briefToMarkdown(brief: DailyBrief): string {
  const lines: string[] = [];
  lines.push(`# Daily Brief — ${brief.date}`);
  lines.push("");
  lines.push("## Today's priorities");
  brief.priorities.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  lines.push("");
  lines.push("## New opportunities");
  brief.opportunities.forEach((o) => lines.push(`- ${o}`));
  lines.push("");
  lines.push("## Urgent issues");
  brief.urgentIssues.forEach((u) => lines.push(`- ${u}`));
  lines.push("");
  lines.push("## KPIs");
  lines.push(`- Marketing: ${brief.marketingKpi}`);
  lines.push(`- Sales: ${brief.salesKpi}`);
  lines.push(`- Traffic: ${brief.trafficKpi}`);
  lines.push(`- Revenue: ${brief.revenueKpi}`);
  lines.push("");
  lines.push(`_Read time: ~${brief.readMinutes} minutes._`);
  return lines.join("\n");
}
