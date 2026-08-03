import { describe, expect, it } from "vitest";

import { buildGrowthSnapshot } from "@/lib/ops/snapshot";
import { buildExecutionCalendar } from "@/lib/ops/calendar";
import { buildFounderInbox, effortMinutes, todaysTopFive } from "@/lib/ops/inbox";
import type { ActionPlan, ExecutionCalendar, GrowthSnapshot } from "@/lib/ops/types";

const snapshot: GrowthSnapshot = buildGrowthSnapshot({
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  daily: [],
  pages: [],
  content: [],
  runs: [],
  customers: [
    {
      id: "c1",
      owner_id: "u",
      email: "a@b.c",
      company: null,
      industry: null,
      status: "churned",
      plan: null,
      mrr_usd: 0,
      last_contact_at: null,
      created_at: "2026-01-01",
    },
  ],
  prospects: [],
  keywords: [],
});

const actionPlan: ActionPlan = {
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  generatedAt: "2026-08-03",
  revenueForecastUsd: 0,
  actions: [],
};

const calendar: ExecutionCalendar = buildExecutionCalendar({
  weekStart: "2026-08-03",
  weekEnd: "2026-08-09",
  actionPlan,
  publishingPlan: { weekStart: "2026-08-03", weekEnd: "2026-08-09", slots: [] },
  seoPlan: { weekStart: "2026-08-03", weekEnd: "2026-08-09", tasks: [], decliningPages: [], risingCompetitors: [], keywordGaps: [] },
  leadPlan: { weekStart: "2026-08-03", weekEnd: "2026-08-09", items: [], topMagnets: [] },
  opportunities: { weekStart: "2026-08-03", weekEnd: "2026-08-09", opportunities: [] },
});

describe("effortMinutes", () => {
  it("maps priorities to realistic effort", () => {
    expect(effortMinutes("P0")).toBe(30);
    expect(effortMinutes("P1")).toBe(20);
    expect(effortMinutes("P2")).toBe(10);
  });
});

describe("todaysTopFive", () => {
  const fullCalendar: ExecutionCalendar = {
    ...calendar,
    tasks: [
      { id: "t1", date: "2026-08-04", horizon: "daily", title: "Close Marrakech deal", source: "sales", priority: "P0", deadline: "2026-08-04", roiUsd: 800, estTraffic: 0, estLeads: 0, estMrrUsd: 200 },
      { id: "t2", date: "2026-08-04", horizon: "daily", title: "Publish SEO guide", source: "publishing", priority: "P1", deadline: "2026-08-04", roiUsd: 200, estTraffic: 100, estLeads: 2, estMrrUsd: 50 },
      { id: "t3", date: "2026-08-05", horizon: "daily", title: "Follow up demo", source: "sales", priority: "P0", deadline: "2026-08-05", roiUsd: 600, estTraffic: 0, estLeads: 0, estMrrUsd: 150 },
    ],
    totals: { roiUsd: 0, traffic: 0, leads: 0, mrrUsd: 0 },
  };

  it("picks today's tasks ranked by priority then ROI", () => {
    const top = todaysTopFive(fullCalendar, "2026-08-04");
    expect(top.map((p) => p.title)).toEqual(["Close Marrakech deal", "Publish SEO guide"]);
  });

  it("falls back to upcoming tasks when none are due today", () => {
    const top = todaysTopFive(fullCalendar, "2026-08-09");
    expect(top.length).toBe(3);
    expect(top[0].title).toBe("Close Marrakech deal");
  });
});

describe("buildFounderInbox", () => {
  it("returns exactly 5 priorities when available", () => {
    const many: ExecutionCalendar = {
      ...calendar,
      tasks: Array.from({ length: 8 }, (_, i) => ({
        id: `t${i}`,
        date: "2026-08-04",
        horizon: "daily" as const,
        title: `Task ${i}`,
        source: "seo",
        priority: "P1" as const,
        deadline: "2026-08-04",
        roiUsd: 100,
        estTraffic: 50,
        estLeads: 1,
        estMrrUsd: 20,
      })),
      totals: { roiUsd: 0, traffic: 0, leads: 0, mrrUsd: 0 },
    };
    const inbox = buildFounderInbox({ date: "2026-08-04", snapshot, calendar: many });
    expect(inbox.priorities.length).toBe(5);
  });

  it("keeps reading time under 2 minutes", () => {
    const many: ExecutionCalendar = {
      ...calendar,
      tasks: Array.from({ length: 8 }, (_, i) => ({
        id: `t${i}`,
        date: "2026-08-04",
        horizon: "daily" as const,
        title: `Task with a fairly long descriptive title ${i}`,
        source: "seo",
        priority: "P1" as const,
        deadline: "2026-08-04",
        roiUsd: 100,
        estTraffic: 50,
        estLeads: 1,
        estMrrUsd: 20,
      })),
      totals: { roiUsd: 0, traffic: 0, leads: 0, mrrUsd: 0 },
    };
    const inbox = buildFounderInbox({ date: "2026-08-04", snapshot, calendar: many });
    expect(inbox.readMinutes).toBeLessThanOrEqual(2);
    expect(inbox.readMinutes).toBeGreaterThanOrEqual(1);
  });

  it("surfaces urgent issues (churn, traffic drop)", () => {
    const inbox = buildFounderInbox({ date: "2026-08-04", snapshot, calendar });
    expect(inbox.urgentIssues.some((i) => i.includes("churned"))).toBe(true);
  });

  it("is deterministic", () => {
    const a = buildFounderInbox({ date: "2026-08-04", snapshot, calendar });
    const b = buildFounderInbox({ date: "2026-08-04", snapshot, calendar });
    expect(a).toEqual(b);
  });
});
