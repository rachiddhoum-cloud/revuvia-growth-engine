/**
 * Auto publishing queue — Sprint 4, Phase 1.
 *
 * Every approved article automatically enters a multi-platform queue:
 * blog (content_items.scheduled_for), LinkedIn / Facebook / X
 * (social_posts). Dates are scheduled deterministically — no manual
 * planning. `dueSlots` / `markPublished` drive the daily cron.
 */

import type { ArticleRef, PublishingPlan, PublishingSlot, PublishPlatform } from "@/lib/ops/types";
import { blogPostUrl } from "@/lib/publishing/site-config";

export interface PublishingOptions {
  /** First day of the queue window, yyyy-mm-dd (defaults to today local). */
  startDate?: string;
  /** Number of days in the window (default 7). */
  days?: number;
  /** Blog slots allowed per week (default 2). Extra articles roll to next week. */
  blogPerWeek?: number;
}

export const SOCIAL_PLATFORMS: PublishPlatform[] = ["linkedin", "facebook", "x"];

function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's date as yyyy-mm-dd in local time. */
export function todayLocal(): string {
  return toLocalIso(new Date());
}

/** Add `offset` days to a yyyy-mm-dd string, keeping local time. */
export function addDays(date: string, offset: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offset);
  return toLocalIso(dt);
}

/** Platform-specific draft copy for an article. */
export function draftForPlatform(article: ArticleRef, platform: PublishPlatform): string {
  const url = article.slug ? blogPostUrl(article.slug) : "link in bio";
  const hook = article.excerpt?.slice(0, 140) ?? article.title;
  switch (platform) {
    case "blog":
      return `# ${article.title}\n\n${hook}\n\n[Read the full article](${url})`;
    case "linkedin":
      return [
        article.title,
        "",
        hook,
        "",
        "What is one change that would move the needle?",
        "",
        `Read more: ${url}`,
      ].join("\n");
    case "facebook":
      return `${article.title}\n\n${hook}\n\n${url}`;
    case "x":
      return `${article.title} — ${hook.slice(0, 90)} ${url}`;
  }
}

export interface ScheduleResult {
  plan: PublishingPlan;
  blogNextWeek: ArticleRef[];
}

/**
 * Deterministically schedule approved articles across platforms.
 * Blog slots are capped at `blogPerWeek` per week (roll to next Monday);
 * every article still gets a LinkedIn/Facebook/X slot, staggered by one day.
 */
export function schedulePublishing(
  articles: ArticleRef[],
  opts: PublishingOptions = {}
): ScheduleResult {
  const startDate = opts.startDate ?? todayLocal();
  const days = Math.max(1, opts.days ?? 7);
  const blogPerWeek = Math.max(1, opts.blogPerWeek ?? 2);

  const weekStart = startDate;
  const weekEnd = addDays(startDate, days - 1);
  const nextWeekStart = addDays(startDate, 7);

  const slots: PublishingSlot[] = [];
  const blogNextWeek: ArticleRef[] = [];
  let blogCount = 0;

  articles.forEach((article) => {
    let blogDate: string;
    if (blogCount < blogPerWeek) {
      blogDate = addDays(startDate, blogCount);
      blogCount++;
    } else {
      blogDate = addDays(nextWeekStart, blogNextWeek.length);
      blogNextWeek.push(article);
    }

    slots.push({
      id: `pub-${article.id}-blog`,
      contentItemId: article.id,
      title: article.title,
      platform: "blog",
      scheduledFor: blogDate,
      status: "scheduled",
      draft: draftForPlatform(article, "blog"),
    });

    SOCIAL_PLATFORMS.forEach((platform, offset) => {
      slots.push({
        id: `pub-${article.id}-${platform}`,
        contentItemId: article.id,
        title: article.title,
        platform,
        scheduledFor: addDays(blogDate, offset + 1),
        status: "scheduled",
        draft: draftForPlatform(article, platform),
      });
    });
  });

  const sorted = [...slots].sort(
    (a, b) =>
      a.scheduledFor.localeCompare(b.scheduledFor) ||
      a.contentItemId.localeCompare(b.contentItemId) ||
      a.platform.localeCompare(b.platform)
  );

  return { plan: { weekStart, weekEnd, slots: sorted }, blogNextWeek };
}

/** Slots due for publication on or before `today`. */
export function dueSlots(plan: PublishingPlan, today = todayLocal()): PublishingSlot[] {
  return plan.slots.filter((s) => s.status === "scheduled" && s.scheduledFor <= today);
}

/** Mark all due slots as published (pure; the cron persists the changes). */
export function markPublished(plan: PublishingPlan, today = todayLocal()): PublishingPlan {
  const due = new Set(dueSlots(plan, today).map((s) => s.id));
  return {
    ...plan,
    slots: plan.slots.map((s) => (due.has(s.id) ? { ...s, status: "published" as const } : s)),
  };
}

export function publishableArticles(
  articles: {
    id: string;
    title: string;
    slug?: string | null;
    excerpt?: string | null;
    status?: string;
  }[]
): ArticleRef[] {
  return articles
    .filter((a) => a.status === "approved" || a.status === "queued")
    .map(({ id, title, slug, excerpt }) => ({
      id,
      title,
      slug: slug ?? undefined,
      excerpt: excerpt ?? undefined,
    }));
}
