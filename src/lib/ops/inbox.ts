/**
 * Founder inbox — Sprint 4, Phase 7.
 *
 * Every morning: today's Top 5 priorities. Maximum reading time: 2 minutes.
 * Priorities come from the execution calendar (ranked by priority + ROI),
 * urgent issues (churn, traffic drops) are surfaced separately.
 */

import type { ExecutionCalendar, FounderInbox, InboxPriority, GrowthSnapshot } from "@/lib/ops/types";

export interface InboxInput {
  date: string;
  snapshot: GrowthSnapshot;
  calendar: ExecutionCalendar;
}

const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2 };

/** Effort estimate in minutes from the priority label. */
export function effortMinutes(priority: InboxPriority["priority"]): number {
  return priority === "P0" ? 30 : priority === "P1" ? 20 : 10;
}

/** Urgent issues: churn + declining traffic. */
export function urgentIssues(snapshot: GrowthSnapshot): string[] {
  const issues: string[] = [];
  if (snapshot.customers.churned > 0) {
    issues.push(`${snapshot.customers.churned} customer(s) churned this week — call them today.`);
  }
  if (snapshot.previous.visits > 0 && snapshot.weekly.visits < snapshot.previous.visits) {
    issues.push(`Traffic down ${Math.round(((snapshot.previous.visits - snapshot.weekly.visits) / snapshot.previous.visits) * 100)}% vs last week.`);
  }
  return issues;
}

/** Today's top 5 priorities from the calendar. */
export function todaysTopFive(calendar: ExecutionCalendar, date: string): InboxPriority[] {
  const todayTasks = calendar.tasks.filter((t) => t.date === date);
  const ranked = [...todayTasks].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
      b.roiUsd - a.roiUsd ||
      a.id.localeCompare(b.id)
  );
  const top = ranked.slice(0, 5);
  if (top.length === 0) {
    return calendar.tasks.slice(0, 5).map((t, i) => ({
      rank: i + 1,
      title: t.title,
      why: `Scheduled for ${t.date} (${t.source}).`,
      effortMinutes: effortMinutes(t.priority),
      priority: t.priority,
    }));
  }
  return top.map((t, i) => ({
    rank: i + 1,
    title: t.title,
    why: `+$${t.roiUsd} ROI · ${t.estTraffic} visits est. (${t.source}).`,
    effortMinutes: effortMinutes(t.priority),
    priority: t.priority,
  }));
}

/** Build the founder inbox (read time always <= 2 min). */
export function buildFounderInbox(input: InboxInput): FounderInbox {
  const priorities = todaysTopFive(input.calendar, input.date);
  const issues = urgentIssues(input.snapshot);

  const chars = priorities.reduce((acc, p) => acc + p.title.length + p.why.length, 0);
  const readMinutes = Math.min(2, Math.max(1, Math.ceil(chars / 700)));

  return {
    date: input.date,
    priorities,
    readMinutes,
    urgentIssues: issues,
  };
}
