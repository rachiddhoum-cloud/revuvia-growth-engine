import type { CalendarPlan, CalendarPlanItem, CalendarChannel } from "@/types";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

interface GeneratePlanInput {
  startDate: string; // ISO date
  frequency: "daily" | "weekly" | "monthly";
  themes?: string[];
  channels?: CalendarChannel[];
}

const DEFAULT_THEMES = [
  "Google review tips",
  "QR code best practices",
  "customer experience",
  "local SEO",
  "social proof",
  "review response etiquette",
];

const CHANNEL_ORDER: CalendarChannel[] = ["blog", "linkedin", "x", "instagram", "facebook", "email"];

/** Build a publishing plan deterministically (no AI call — instant and editable). */
export function generateCalendarPlan(input: GeneratePlanInput): CalendarPlan {
  const start = new Date(input.startDate);
  const themes = input.themes?.length ? input.themes : DEFAULT_THEMES;
  const channels = input.channels?.length ? input.channels : CHANNEL_ORDER;
  const items: CalendarPlanItem[] = [];

  const iterations =
    input.frequency === "daily" ? 14 : input.frequency === "weekly" ? 4 : 1;

  for (let i = 0; i < iterations; i++) {
    const theme = themes[i % themes.length];
    if (input.frequency === "monthly" && i > 0) continue;

    if (input.frequency === "monthly") {
      // one month: 1 blog + 2 posts per channel cadence
      items.push({
        title: `Monthly deep-dive: ${theme}`,
        channel: "blog",
        scheduledAt: isoAt(start, i),
        status: "idea",
      });
      channels.forEach((channel, c) => {
        items.push({
          title: `${theme} — ${channel} update`,
          channel,
          scheduledAt: isoAt(start, i * 7 + c),
          status: "idea",
        });
      });
    } else if (input.frequency === "weekly") {
      items.push({
        title: `Weekly guide: ${theme}`,
        channel: "blog",
        scheduledAt: isoAt(start, i * 7),
        status: "idea",
      });
      channels.forEach((channel, c) => {
        items.push({
          title: `${theme} — ${channel}`,
          channel,
          scheduledAt: isoAt(start, i * 7 + ((c + 1) % 7)),
          status: "idea",
        });
      });
    } else {
      const day = WEEKDAYS[i % WEEKDAYS.length];
      const channel = channels[i % channels.length];
      items.push({
        title: `${day} · ${theme} — ${channel}`,
        channel,
        scheduledAt: isoAt(start, i),
        status: "idea",
      });
    }
  }

  // stable sort by date
  items.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  return {
    startDate: input.startDate,
    frequency: input.frequency,
    items,
  };
}

function isoAt(start: Date, dayOffset: number): string {
  const d = new Date(start);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}
