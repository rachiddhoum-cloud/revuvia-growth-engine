import { describe, expect, it } from "vitest";

import { generateCalendarPlan } from "@/lib/calendar";

describe("generateCalendarPlan", () => {
  it("generates 14 daily items sorted by date", () => {
    const plan = generateCalendarPlan({ startDate: "2026-08-01", frequency: "daily" });
    expect(plan.items).toHaveLength(14);
    for (let i = 1; i < plan.items.length; i++) {
      const prev = new Date(plan.items[i - 1].scheduledAt).getTime();
      const curr = new Date(plan.items[i].scheduledAt).getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
    expect(plan.items.every((item) => item.status === "idea")).toBe(true);
  });

  it("generates weekly blog + channel items", () => {
    const plan = generateCalendarPlan({ startDate: "2026-08-01", frequency: "weekly" });
    expect(plan.items.length).toBeGreaterThan(4);
    expect(plan.items.some((item) => item.channel === "blog")).toBe(true);
    expect(plan.items.some((item) => item.channel === "linkedin")).toBe(true);
  });

  it("generates a monthly plan with a blog deep-dive", () => {
    const plan = generateCalendarPlan({ startDate: "2026-08-01", frequency: "monthly" });
    const deepDives = plan.items.filter((item) => item.title.includes("Monthly deep-dive"));
    expect(deepDives.length).toBe(1);
    expect(deepDives[0].channel).toBe("blog");
  });

  it("uses provided channels only", () => {
    const plan = generateCalendarPlan({
      startDate: "2026-08-01",
      frequency: "daily",
      channels: ["blog", "x"],
    });
    expect(plan.items.every((item) => item.channel === "blog" || item.channel === "x")).toBe(true);
  });

  it("schedules items at 9:00", () => {
    const plan = generateCalendarPlan({ startDate: "2026-08-01", frequency: "daily" });
    for (const item of plan.items) {
      const date = new Date(item.scheduledAt);
      expect(date.getHours()).toBe(9);
    }
  });
});
