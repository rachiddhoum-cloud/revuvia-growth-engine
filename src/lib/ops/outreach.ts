/**
 * Backlink outreach queue — Sprint 7.
 *
 * Turns zero-authority pages (GSC traffic, zero internal links, zero
 * backlinks) into a ranked link-building outreach queue: ICE scoring,
 * anchor suggestions and ready-to-send email drafts, optionally
 * personalized with the best-matching prospect (shared keywords between
 * the prospect's company and the page title). Deterministic.
 */

import { iceScore, priorityFromIce } from "@/lib/ops/ice";
import { keywordTokens } from "@/lib/ops/linking";
import { anchorFromTitle, zeroAuthorityPages, type PageStat } from "@/lib/gsc/linking-intel";
import type { ActionPriority } from "@/lib/ops/types";

export interface OutreachProspect {
  company: string;
  industry: string | null;
  contactName?: string | null;
}

export interface OutreachTask {
  id: string;
  pageUrl: string;
  pageTitle: string;
  anchor: string;
  clicks: number;
  impressions: number;
  ice: number;
  priority: ActionPriority;
  expectedTrafficGain: number; // weekly visits
  reasoning: string;
  emailDraft: string;
  prospectCompany: string | null;
}

export interface OutreachPlan {
  tasks: OutreachTask[]; // ranked by ice desc
}

export interface OutreachInput {
  pages: PageStat[];
  /** Real backlinks (Ahrefs): url → { count, maxDomainRating }. */
  externalLinks?: Map<string, { count: number; maxDomainRating: number }>;
  prospects?: OutreachProspect[];
  companyName?: string;
  domain?: string;
  /** Cap on generated tasks (default 10). */
  limit?: number;
}

/** Human-readable title derived from a URL path (fallback when no title). */
export function titleFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname
      .split("/")
      .filter((s) => s.length > 0)
      .pop();
    if (!path) return "";
    const words = decodeURIComponent(path)
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .trim();
    return words.length > 0 ? words : "";
  } catch {
    return "";
  }
}

function impactFromClicks(clicks: number): number {
  if (clicks >= 200) return 8;
  if (clicks >= 50) return 7;
  if (clicks >= 10) return 6;
  if (clicks > 0) return 5;
  return 4;
}

/** Best-matching prospect: most shared keyword tokens with the page title. */
export function matchProspect(
  prospects: OutreachProspect[],
  title: string
): OutreachProspect | null {
  if (prospects.length === 0) return null;
  const titleTokens = keywordTokens(title);
  if (titleTokens.length === 0) return null;

  let best: OutreachProspect | null = null;
  let bestShared = 0;
  for (const prospect of prospects) {
    const shared = keywordTokens(prospect.company).filter((t) => titleTokens.includes(t)).length;
    if (shared > bestShared) {
      best = prospect;
      bestShared = shared;
    }
  }
  return bestShared > 0 ? best : null;
}

export function buildOutreachEmailDraft(input: {
  pageTitle: string;
  pageUrl: string;
  impressions: number;
  anchor: string;
  companyName?: string;
  domain?: string;
  prospect?: OutreachProspect | null;
}): string {
  const sender = input.companyName ?? "our team";
  const from = input.domain ? ` (${input.domain})` : "";
  const personal = input.prospect
    ? `\n\nGiven ${input.prospect.company}'s focus on ${input.prospect.industry ?? "your industry"}, a link would be a natural fit for your readers.`
    : "";
  return [
    `Hi${input.prospect?.contactName ? ` ${input.prospect.contactName}` : ""},`,
    "",
    `I run ${sender}${from}, and we recently published a resource — "${input.pageTitle}" (${input.pageUrl}). It earns ${input.impressions} impressions in search but has no backlinks yet, so a mention from related content would go a long way.${personal}`,
    "",
    `If it looks useful, a link with the anchor "${input.anchor}" would be perfect. Happy to reciprocate.`,
    "",
    `Thanks,`,
    sender,
  ].join("\n");
}

export function buildOutreachQueue(input: OutreachInput): OutreachPlan {
  const external = input.externalLinks ?? new Map<string, { count: number; maxDomainRating: number }>();
  const prospects = input.prospects ?? [];
  const limit = input.limit ?? 10;

  const tasks: OutreachTask[] = [];
  let index = 0;

  for (const page of zeroAuthorityPages(input.pages, external).slice(0, limit)) {
    const pageTitle = page.title || titleFromUrl(page.url) || page.url;
    const anchor = anchorFromTitle(pageTitle);
    const prospect = matchProspect(prospects, pageTitle);
    const ice = iceScore(impactFromClicks(page.clicks), 0.55, 6);

    tasks.push({
      id: `outreach-${index++}`,
      pageUrl: page.url,
      pageTitle,
      anchor,
      clicks: page.clicks,
      impressions: page.impressions,
      ice,
      priority: priorityFromIce(ice),
      expectedTrafficGain: Math.round(page.impressions * 0.02),
      reasoning: `Page earns ${page.impressions} impressions with zero internal links and zero backlinks — building ${prospect ? `a relationship with ${prospect.company}` : "external links"} is the highest-leverage action.`,
      emailDraft: buildOutreachEmailDraft({
        pageTitle,
        pageUrl: page.url,
        impressions: page.impressions,
        anchor,
        companyName: input.companyName,
        domain: input.domain,
        prospect,
      }),
      prospectCompany: prospect?.company ?? null,
    });
  }

  tasks.sort(
    (a, b) =>
      b.ice - a.ice ||
      b.clicks - a.clicks ||
      a.pageUrl.localeCompare(b.pageUrl)
  );
  tasks.forEach((t, i) => {
    t.id = `outreach-${i}`;
  });

  return { tasks };
}
