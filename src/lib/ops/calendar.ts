/**
 * Execution calendar — Sprint 4, Phase 6.
 *
 * Generates a real execution calendar (daily / weekly / monthly) from every
 * artifact: action plan, publishing queue, SEO loop, lead loop and
 * opportunities. Every task carries priority, deadline, expected ROI,
 * estimated traffic, expected leads and expected MRR.
 */

import { priorityFromIce } from "@/lib/ops/ice";
import { addDays } from "@/lib/ops/publishing";
import type { OutreachPlan } from "@/lib/ops/outreach";
import type {
  ActionPlan,
  CalendarTask,
  ExecutionCalendar,
  LeadGenerationPlan,
  OpportunityScan,
  PublishingPlan,
  SeoOptimizationPlan,
} from "@/lib/ops/types";

export interface CalendarInput {
  weekStart: string;
  weekEnd: string;
  actionPlan: ActionPlan;
  publishingPlan: PublishingPlan;
  seoPlan: SeoOptimizationPlan;
  leadPlan: LeadGenerationPlan;
  opportunities: OpportunityScan;
  /** Backlink outreach queue (Sprint 7) — optional. */
  outreachPlan?: OutreachPlan;
  /** Estimated SEO traffic for the week (per-article estimate basis). */
  estimatedSeoTraffic?: number;
  /** Visits → lead conversion (0-1). */
  leadRate?: number;
}

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

export function buildExecutionCalendar(input: CalendarInput): ExecutionCalendar {
  const {
    weekStart,
    weekEnd,
    actionPlan,
    publishingPlan,
    seoPlan,
    leadPlan,
    opportunities,
    outreachPlan,
    estimatedSeoTraffic = 0,
    leadRate = 0.02,
  } = input;

  const tasks: CalendarTask[] = [];
  let index = 0;

  const traffic = (v: number) => Math.round(v);
  const leads = (v: number) => Math.round(v * leadRate);
  const mrr = (v: number) => Math.round(v * leadRate * 40);

  // Daily: one action per day, plus due publishing slots.
  actionPlan.actions.slice(0, 7).forEach((action, i) => {
    tasks.push({
      id: `cal-daily-${index++}`,
      date: addDays(weekStart, i),
      horizon: "daily",
      title: action.title,
      source: action.kind,
      priority: action.priority,
      deadline: addDays(weekStart, i),
      roiUsd: action.mrrImpactUsd * 4,
      estTraffic: 0,
      estLeads: 0,
      estMrrUsd: action.mrrImpactUsd,
    });
  });

  publishingPlan.slots
    .filter((s) => s.platform === "blog" && s.scheduledFor <= weekEnd)
    .forEach((slot) => {
      const perArticle = estimatedSeoTraffic > 0 ? Math.max(5, Math.round(estimatedSeoTraffic * 0.15)) : 30;
      tasks.push({
        id: `cal-publish-${index++}`,
        date: slot.scheduledFor,
        horizon: "daily",
        title: `Publish blog: ${slot.title}`,
        source: "publishing",
        priority: priorityFromIce(600),
        deadline: slot.scheduledFor,
        roiUsd: traffic(perArticle * 0.02 * 40),
        estTraffic: traffic(perArticle),
        estLeads: leads(perArticle),
        estMrrUsd: mrr(perArticle),
      });
    });

  // Weekly: SEO tasks + top lead items + link-building outreach.
  seoPlan.tasks.slice(0, 3).forEach((task) => {
    tasks.push({
      id: `cal-weekly-${index++}`,
      date: weekEnd,
      horizon: "weekly",
      title: task.title,
      source: "seo",
      priority: priorityFromIce(task.ice),
      deadline: weekEnd,
      roiUsd: Math.round(task.ice * 2),
      estTraffic: Math.round(task.ice * 2),
      estLeads: leads(Math.round(task.ice * 2)),
      estMrrUsd: mrr(Math.round(task.ice * 2)),
    });
  });

  leadPlan.items.slice(0, 3).forEach((item) => {
    tasks.push({
      id: `cal-weekly-lead-${index++}`,
      date: weekEnd,
      horizon: "weekly",
      title: item.title,
      source: "leads",
      priority: priorityFromIce(item.ice),
      deadline: weekEnd,
      roiUsd: Math.round(item.ice * 2),
      estTraffic: Math.round(item.ice * 2),
      estLeads: leads(Math.round(item.ice * 2)),
      estMrrUsd: mrr(Math.round(item.ice * 2)),
    });
  });

  // Link-building outreach: one task per day across the week.
  (outreachPlan?.tasks ?? []).slice(0, 5).forEach((task, i) => {
    tasks.push({
      id: `cal-outreach-${index++}`,
      date: addDays(weekStart, Math.min(i, 6)),
      horizon: "weekly",
      title: `Outreach: backlink for ${task.pageTitle}`,
      source: "link_building",
      priority: task.priority,
      deadline: weekEnd,
      roiUsd: Math.round(task.ice * 2),
      estTraffic: task.expectedTrafficGain,
      estLeads: leads(task.expectedTrafficGain),
      estMrrUsd: mrr(task.expectedTrafficGain),
    });
  });

  // Monthly: top opportunities.
  opportunities.opportunities.slice(0, 3).forEach((opp) => {
    tasks.push({
      id: `cal-monthly-${index++}`,
      date: addDays(weekEnd, 21),
      horizon: "monthly",
      title: opp.title,
      source: "opportunities",
      priority: priorityFromIce(opp.roiScore * 8),
      deadline: addDays(weekEnd, 21),
      roiUsd: opp.estMrrUsd * 3,
      estTraffic: opp.estTraffic,
      estLeads: opp.estLeads,
      estMrrUsd: opp.estMrrUsd,
    });
  });

  tasks.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      a.id.localeCompare(b.id)
  );

  const totals = tasks.reduce(
    (acc, t) => ({
      roiUsd: acc.roiUsd + t.roiUsd,
      traffic: acc.traffic + t.estTraffic,
      leads: acc.leads + t.estLeads,
      mrrUsd: acc.mrrUsd + t.estMrrUsd,
    }),
    { roiUsd: 0, traffic: 0, leads: 0, mrrUsd: 0 }
  );

  return { weekStart, weekEnd, tasks, totals };
}
