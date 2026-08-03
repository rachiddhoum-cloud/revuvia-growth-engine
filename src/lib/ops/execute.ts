/**
 * Autonomous execution engine — Sprint 4.
 *
 * Server-only orchestrator behind the cron routes:
 *   - `executeWeeklyLoop`  → linking plan, SEO loop, lead loop, opportunities,
 *                            execution calendar, growth score (Monday).
 *   - `runPublishing`      → creates the multi-platform queue from approved
 *                            articles and marks due slots as published (daily).
 *   - `runFounderInbox`    → today's top 5 priorities (daily morning).
 *
 * Every persistence path is idempotent: report upserts key on
 * `(owner_id, type, period_start)`, internal links on `(content_item_id,
 * target_url)`, and social posts are only inserted when missing.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase";
import type { Json, ReportType } from "@/types/supabase";
import { logger } from "@/lib/log/logger";
import { loadGrowthSnapshot } from "@/lib/ops/load";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";
import {
  analyzeInternalLinks,
  buildActionPlan,
  buildContentQueue,
  buildExecutionCalendar,
  buildFounderInbox,
  buildGrowthScore,
  buildLeadGenerationPlan,
  buildOpportunities,
  buildSalesPlan,
  buildSeoMissions,
  buildSeoOptimizationPlan,
  keywordTokens,
  markPublished,
  publishableArticles,
  schedulePublishing,
  todayLocal,
} from "@/lib/ops";
import type {
  ExecutionCalendar,
  FounderInbox,
  GrowthScore,
  InternalLinkingPlan,
  LeadGenerationPlan,
  OpportunityScan,
  PublishingPlan,
  SeoOptimizationPlan,
} from "@/lib/ops/types";
import { publishToPlatform } from "@/lib/social/connectors";
import type { PageStat } from "@/lib/gsc/linking-intel";
import {
  buildOutreachQueue,
  type OutreachPlan,
  type OutreachProspect,
} from "@/lib/ops/outreach";
import { findEvidence, evidenceLine } from "@/lib/learning/confidence";
import { toKnowledgeEntry } from "@/lib/learning/server";
import type { KnowledgeEntry } from "@/lib/learning/types";

/** Topic words from a title (fuzzy knowledge matching). */
function topicWords(title: string): string {
  return title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zà-ÿ0-9]/gi, ""))
    .filter((w) => w.length > 3)
    .slice(0, 2)
    .join(" ");
}

export interface ExecutionSummary {
  ok: boolean;
  artifacts: Record<string, unknown>;
}

/** Load the social credential for a platform, when connected (Sprint 6). */
async function loadSocialCredential(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  platform: "linkedin" | "facebook" | "x"
): Promise<import("@/lib/social/connectors").SocialCredential | null> {
  const { data } = await sb
    .from("social_credentials")
    .select("platform,access_token,account_id,account_name")
    .eq("owner_id", ownerId)
    .eq("platform", platform)
    .limit(1)
    .maybeSingle();
  if (!data || !data.access_token) return null;
  return data;
}

const EMPTY_CALENDAR: ExecutionCalendar = {
  weekStart: "",
  weekEnd: "",
  tasks: [],
  totals: { roiUsd: 0, traffic: 0, leads: 0, mrrUsd: 0 },
};

interface OutreachLoadedInput {
  pages: PageStat[];
  externalLinks: Map<string, { count: number; maxDomainRating: number }>;
  prospects: OutreachProspect[];
  companyName?: string;
  domain?: string;
}

/** Load GSC pages (28d), internal link counts, backlinks and prospects. */
async function loadOutreachInput(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string
): Promise<OutreachLoadedInput> {
  const since = new Date(Date.now() - 28 * 86400_000).toISOString().slice(0, 10);
  const [pageRows, contentRows, linkRows, backlinkRows, prospectRows, siteRows] = await Promise.all([
    sb
      .from("search_console_pages")
      .select("url,clicks,impressions")
      .eq("owner_id", ownerId)
      .gte("date", since),
    sb.from("content_items").select("id").eq("owner_id", ownerId),
    sb.from("internal_links").select("content_item_id,target_url"),
    sb
      .from("ahrefs_backlinks")
      .select("url_to,domain_rating")
      .eq("owner_id", ownerId),
    sb.from("prospects").select("company,industry,contact_name").eq("owner_id", ownerId),
    sb.from("search_console_sites").select("site_url,name").eq("owner_id", ownerId).limit(1),
  ]);
  if (pageRows.error) throw new Error(`Failed to load GSC pages: ${pageRows.error.message}`);
  if (linkRows.error) throw new Error(`Failed to load internal links: ${linkRows.error.message}`);
  if (backlinkRows.error) throw new Error(`Failed to load backlinks: ${backlinkRows.error.message}`);

  const clicksByUrl = new Map<string, number>();
  const impressionsByUrl = new Map<string, number>();
  for (const row of pageRows.data ?? []) {
    clicksByUrl.set(row.url, (clicksByUrl.get(row.url) ?? 0) + (row.clicks ?? 0));
    impressionsByUrl.set(row.url, (impressionsByUrl.get(row.url) ?? 0) + (row.impressions ?? 0));
  }

  const ownerContentIds = new Set((contentRows.data ?? []).map((r) => r.id));
  const incomingByUrl = new Map<string, number>();
  for (const row of linkRows.data ?? []) {
    if (!ownerContentIds.has(row.content_item_id)) continue;
    incomingByUrl.set(row.target_url, (incomingByUrl.get(row.target_url) ?? 0) + 1);
  }

  const externalLinks = new Map<string, { count: number; maxDomainRating: number }>();
  for (const row of backlinkRows.data ?? []) {
    const prev = externalLinks.get(row.url_to);
    externalLinks.set(row.url_to, {
      count: (prev?.count ?? 0) + 1,
      maxDomainRating: Math.max(prev?.maxDomainRating ?? 0, row.domain_rating ?? 0),
    });
  }

  const pages: PageStat[] = [...clicksByUrl.keys()].map((url) => ({
    url,
    title: "",
    clicks: clicksByUrl.get(url) ?? 0,
    impressions: impressionsByUrl.get(url) ?? 0,
    incomingLinks: incomingByUrl.get(url) ?? 0,
  }));

  const site = siteRows.data?.[0];
  let domain: string | undefined;
  if (site?.site_url) {
    try {
      domain = new URL(site.site_url).hostname;
    } catch {
      domain = undefined;
    }
  }

  return {
    pages,
    externalLinks,
    prospects: (prospectRows.data ?? []).map((p) => ({
      company: p.company ?? "Unknown",
      industry: p.industry,
      contactName: p.contact_name,
    })),
    companyName: site?.name ?? domain,
    domain,
  };
}

/** Friday/outreach cron: build and persist the backlink outreach queue. */
export async function runOutreachQueue(
  ownerId = "system"
): Promise<{ ok: boolean; plan: OutreachPlan; artifacts: Record<string, unknown> }> {
  const sb = createServiceRoleClient();
  const input = await loadOutreachInput(sb, ownerId);
  const plan = buildOutreachQueue(input);
  const today = todayLocal();

  const { data: existing, error: existingError } = await sb
    .from("outreach_tasks")
    .select("page_url,status")
    .eq("owner_id", ownerId);
  if (existingError) throw new Error(`Failed to load outreach tasks: ${existingError.message}`);
  const statusByUrl = new Map((existing ?? []).map((r) => [r.page_url, r.status]));

  for (const task of plan.tasks) {
    const { error } = await sb.from("outreach_tasks").upsert(
      {
        owner_id: ownerId,
        page_url: task.pageUrl,
        page_title: task.pageTitle,
        clicks: task.clicks,
        impressions: task.impressions,
        anchor: task.anchor,
        ice: task.ice,
        priority: task.priority,
        expected_traffic: task.expectedTrafficGain,
        email_draft: task.emailDraft,
        reasoning: task.reasoning,
        status: statusByUrl.get(task.pageUrl) ?? "queued",
      },
      { onConflict: "owner_id,page_url" }
    );
    if (error) throw new Error(`Failed to persist outreach task: ${error.message}`);
  }

  const totalClicks = plan.tasks.reduce((acc, t) => acc + t.clicks, 0);
  const totalImpressions = plan.tasks.reduce((acc, t) => acc + t.impressions, 0);
  await persistReport(
    sb,
    ownerId,
    "outreach_plan",
    today,
    today,
    [
      `# Backlink outreach queue — ${today}`,
      "",
      plan.tasks.length > 0
        ? `${plan.tasks.length} zero-authority pages (traffic but no internal links and no backlinks) — ICE-ranked link-building targets.`
        : "No zero-authority pages — nothing to do this week. Connect GSC and Ahrefs to unlock link-building targets.",
      "",
      ...plan.tasks.map(
        (t) =>
          `- **[${t.priority}] ${t.pageTitle}** — ICE ${t.ice.toFixed(1)} · ${t.clicks} clicks · ${t.impressions} impressions · +${t.expectedTrafficGain} visits est.\n  Anchor: "${t.anchor}" — ${t.reasoning}\n  Draft: ${t.emailDraft}`
      ),
    ].join("\n"),
    { plan, generatedAt: today, totalClicks, totalImpressions }
  );

  return {
    ok: true,
    plan,
    artifacts: {
      targets: plan.tasks.length,
      clicks: totalClicks,
      impressions: totalImpressions,
      topIce: plan.tasks[0]?.ice ?? 0,
    },
  };
}

async function persistReport(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  type: ReportType,
  periodStart: string,
  periodEnd: string,
  markdown: string,
  data: unknown
): Promise<void> {
  const { error } = await sb.from("reports").upsert(
    {
      owner_id: ownerId,
      type,
      period_start: periodStart,
      period_end: periodEnd,
      markdown,
      html: `<pre>${markdown.replace(/</g, "&lt;")}</pre>`,
      email_html: "",
      pdf_ready: "",
      data: data as unknown as Json,
      status: "generated",
    },
    { onConflict: "owner_id,type,period_start" }
  );
  if (error) throw new Error(`Failed to persist ${type}: ${error.message}`);
}

async function loadLatestReportData(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  type: ReportType
): Promise<Record<string, unknown> | null> {
  const { data, error } = await sb
    .from("reports")
    .select("data")
    .eq("type", type)
    .eq("owner_id", ownerId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data || typeof data.data !== "object" || data.data === null) return null;
  return data.data as Record<string, unknown>;
}

function calendarFromReport(row: Record<string, unknown> | null): ExecutionCalendar | null {
  if (!row || typeof row.calendar !== "object" || row.calendar === null) return null;
  return row.calendar as unknown as ExecutionCalendar;
}

/** Monday cron: run every optimizer loop and persist all weekly artifacts. */
export async function executeWeeklyLoop(ownerId = "system"): Promise<ExecutionSummary> {
  const input = await loadGrowthSnapshot(ownerId, 7);
  const snapshot = buildGrowthSnapshot(input);
  const sb = createServiceRoleClient();

  const articles = publishableArticles(snapshot.content);
  const contentRefs = snapshot.content.map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug ?? undefined,
    excerpt: c.excerpt ?? undefined,
  }));

  // Phase 2 — internal linking plan.
  const linkingPlan: InternalLinkingPlan = analyzeInternalLinks(contentRefs);
  for (const s of linkingPlan.suggestions) {
    const target = snapshot.content.find((c) => c.id === s.targetId);
    const targetUrl = target?.slug ? `/blog/${target.slug}` : `/content/${s.targetId}`;
    const { error } = await sb.from("internal_links").upsert(
      {
        content_item_id: s.sourceId,
        target_type: "article",
        target_url: targetUrl,
        anchor_text: s.anchor,
        context_sentence: s.reason,
        source_ai: true,
        status: "active",
      },
      { onConflict: "content_item_id,target_url" }
    );
    if (error) throw new Error(`Failed to persist internal link: ${error.message}`);
  }
  await persistReport(
    sb,
    ownerId,
    "linking_plan",
    snapshot.weekStart,
    snapshot.weekEnd,
    [
      `# Internal linking plan — ${snapshot.weekStart}`,
      "",
      `${linkingPlan.suggestions.length} contextual links · ${linkingPlan.coveragePct}% coverage · ${linkingPlan.orphans.length} orphans`,
      "",
      ...linkingPlan.suggestions.map(
        (s) => `- "${s.anchor}" in "${s.sourceTitle}" → "${s.targetTitle}" (${s.reason})`
      ),
      "",
      "## Orphans",
      "",
      ...(linkingPlan.orphans.length > 0
        ? linkingPlan.orphans.map((o) => `- ${o.title}`)
        : ["- None — all pages receive at least one inbound link."]),
    ].join("\n"),
    { plan: linkingPlan }
  );

  // Phase 3 — SEO optimization loop.
  const coveredKeywords = snapshot.content
    .filter((c) => c.status === "published")
    .flatMap((c) => keywordTokens(c.title));
  const seoPlan: SeoOptimizationPlan = buildSeoOptimizationPlan({
    weekStart: snapshot.weekStart,
    weekEnd: snapshot.weekEnd,
    pageTrends: [],
    competitorSignals: [],
    targetKeywords: snapshot.keywords,
    coveredKeywords,
  });
  await persistReport(
    sb,
    ownerId,
    "seo_loop",
    snapshot.weekStart,
    snapshot.weekEnd,
    [
      `# SEO optimization loop — ${snapshot.weekStart}`,
      "",
      ...(seoPlan.tasks.length > 0
        ? seoPlan.tasks.map((t) => `- **[${t.source}] ${t.title}** — ICE ${t.ice.toFixed(1)}\n  ${t.detail}`)
        : ["- No optimization tasks this week."]),
    ].join("\n"),
    { plan: seoPlan }
  );

  // Phase 4 — lead generation loop.
  const leadPlan: LeadGenerationPlan = buildLeadGenerationPlan({ snapshot });
  await persistReport(
    sb,
    ownerId,
    "lead_loop",
    snapshot.weekStart,
    snapshot.weekEnd,
    [
      `# Lead generation loop — ${snapshot.weekStart}`,
      "",
      ...leadPlan.items.map((i) => `- **[${i.kind}] ${i.title}** — ICE ${i.ice.toFixed(1)}\n  ${i.detail}`),
    ].join("\n"),
    { plan: leadPlan }
  );

  // Phase 5 — opportunity scanner.
  const industries = [
    ...new Set(
      [...input.customers, ...input.prospects]
        .map((c) => c.industry)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];
  const opportunities: OpportunityScan = buildOpportunities({
    weekStart: snapshot.weekStart,
    weekEnd: snapshot.weekEnd,
    month: new Date().getMonth() + 1,
    topics: snapshot.keywords.slice(0, 3),
    industries,
    trendingQueries: [],
    competitorWeaknesses: [],
  });

  // Sprint 8 — decision optimizer: attach historical evidence to every
  // opportunity (Phase 3) using the knowledge base.
  const { data: kbRows } = await sb
    .from("knowledge_base")
    .select("strategy_type,key,confidence,attempts,successes,failures,metrics,uplift_pct,evidence,learned_at")
    .eq("owner_id", ownerId);
  if (kbRows === null) throw new Error("Failed to load knowledge base");
  const knowledge: KnowledgeEntry[] = kbRows.map(toKnowledgeEntry);
  const opportunityEvidence = (opp: { title: string }) =>
    findEvidence(knowledge, "keyword_cluster", undefined, topicWords(opp.title)).slice(0, 1);

  await persistReport(
    sb,
    ownerId,
    "opportunities",
    snapshot.weekStart,
    snapshot.weekEnd,
    [
      `# Opportunity scanner — ${snapshot.weekStart}`,
      "",
      ...(opportunities.opportunities.length > 0
        ? opportunities.opportunities.map((o) => {
            const evidence = opportunityEvidence(o);
            const because = evidence.length > 0 ? `\n  Because: ${evidenceLine(evidence[0])}` : "";
            return `- **[${o.kind}] ${o.title}** — ROI ${o.roiScore}/100 · ~${o.estTraffic} visits · +$${o.estMrrUsd} MRR\n  ${o.detail}${because}`;
          })
        : ["- No opportunities detected. Seed `prospects` industries and keywords."]),
    ].join("\n"),
    {
      plan: opportunities,
      evidence: Object.fromEntries(
        opportunities.opportunities.map((o) => [
          o.id,
          opportunityEvidence(o).map(evidenceLine),
        ])
      ),
    }
  );

  // Shared artifacts: action plan, publishing queue, execution calendar.
  const contentQueue = buildContentQueue([], snapshot).queue;
  const salesPlan = buildSalesPlan({ prospects: snapshot.prospects });
  const actionPlan = buildActionPlan({ snapshot, contentQueue, seoMissions: buildSeoMissions(snapshot), salesPlan });

  const publishing: PublishingPlan = schedulePublishing(articles, { startDate: snapshot.weekStart }).plan;

  // Phase 5.5 — backlink outreach queue (Sprint 7).
  const outreach = await runOutreachQueue(ownerId);

  // Phase 6 — execution calendar.
  const calendar: ExecutionCalendar = buildExecutionCalendar({
    weekStart: snapshot.weekStart,
    weekEnd: snapshot.weekEnd,
    actionPlan,
    publishingPlan: publishing,
    seoPlan,
    leadPlan,
    opportunities,
    outreachPlan: outreach.plan,
    estimatedSeoTraffic: snapshot.estimatedSeoTraffic,
    leadRate: snapshot.conversionRate > 0 ? snapshot.conversionRate : 0.02,
  });
  await persistReport(
    sb,
    ownerId,
    "execution_calendar",
    snapshot.weekStart,
    snapshot.weekEnd,
    [
      `# Execution calendar — ${snapshot.weekStart} to ${snapshot.weekEnd}`,
      "",
      `Totals: +$${calendar.totals.roiUsd} ROI · ${calendar.totals.traffic} visits est. · ${calendar.totals.leads} leads est. · +$${calendar.totals.mrrUsd} MRR`,
      "",
      ...calendar.tasks.map(
        (t) =>
          `- ${t.date} [${t.horizon}] **[${t.priority}] ${t.title}** — ${t.source} · +$${t.roiUsd} ROI · ${t.estTraffic} visits · ${t.estLeads} leads · +$${t.estMrrUsd} MRR`
      ),
    ].join("\n"),
    { calendar }
  );

  // Phase 8 — growth score (with trend from the previous score).
  const previousScore = await loadLatestReportData(sb, ownerId, "growth_score");
  const previousTotal =
    previousScore && typeof previousScore.total === "number" ? previousScore.total : null;
  const publishedCount = snapshot.content.filter((c) => c.status === "published").length;
  const pendingCount = articles.length;
  const completionRate =
    publishedCount + pendingCount > 0 ? publishedCount / (publishedCount + pendingCount) : 0.5;
  const score: GrowthScore = buildGrowthScore({ snapshot, completionRate, previousTotal });
  await persistReport(
    sb,
    ownerId,
    "growth_score",
    snapshot.weekStart,
    snapshot.weekEnd,
    [
      `# Growth score — ${score.total}/100 (${score.trend})`,
      "",
      `- SEO ${score.dimensions.seo} · Content ${score.dimensions.content} · Traffic ${score.dimensions.traffic}`,
      `- Leads ${score.dimensions.leads} · Conversion ${score.dimensions.conversion} · Revenue ${score.dimensions.revenue} · Execution ${score.dimensions.execution}`,
      ...(score.previousTotal !== null ? [`- Previous: ${score.previousTotal}`] : []),
    ].join("\n"),
    score
  );

    return {
      ok: true,
      artifacts: {
        links: linkingPlan.suggestions.length,
        seoTasks: seoPlan.tasks.length,
        leadItems: leadPlan.items.length,
        opportunities: opportunities.opportunities.length,
        outreachTargets: outreach.artifacts.targets,
        calendarTasks: calendar.tasks.length,
        score: score.total,
      },
    };
}

/** Daily cron: ensure the publishing queue exists, then execute due slots. */
export async function runPublishing(ownerId = "system"): Promise<ExecutionSummary> {
  const input = await loadGrowthSnapshot(ownerId, 7);
  const snapshot = buildGrowthSnapshot(input);
  const sb = createServiceRoleClient();

  const today = todayLocal();
  const articles = publishableArticles(snapshot.content);
  const { plan } = schedulePublishing(articles, { startDate: today });

  let created = 0;
  let published = 0;

  for (const slot of plan.slots) {
    if (slot.platform === "blog") {
      const item = snapshot.content.find((c) => c.id === slot.contentItemId);
      if (!item || item.scheduled_for) continue;
      const { error } = await sb
        .from("content_items")
        .update({ scheduled_for: `${slot.scheduledFor}T09:00:00.000Z` })
        .eq("id", slot.contentItemId);
      if (error) throw new Error(`Failed to schedule blog: ${error.message}`);
      created++;
      continue;
    }

    const { data: existing, error: checkError } = await sb
      .from("social_posts")
      .select("id")
      .eq("content_item_id", slot.contentItemId)
      .eq("platform", slot.platform)
      .eq("status", "scheduled")
      .limit(1)
      .maybeSingle();
    if (checkError) throw new Error(`Failed to check social post: ${checkError.message}`);
    if (existing) continue;

    const { error } = await sb.from("social_posts").insert({
      owner_id: ownerId,
      content_item_id: slot.contentItemId,
      platform: slot.platform,
      body: slot.draft,
      status: "scheduled",
      scheduled_for: `${slot.scheduledFor}T10:00:00.000Z`,
    });
    if (error) throw new Error(`Failed to create social post: ${error.message}`);
    created++;
  }

  const publishedPlan = markPublished(plan, today);
  let socialPublished = 0;

  for (const slot of publishedPlan.slots) {
    if (slot.status !== "published") continue;
    if (slot.platform === "blog") {
      const item = snapshot.content.find((c) => c.id === slot.contentItemId);
      if (item?.status === "published") continue;
      const { error } = await sb
        .from("content_items")
        .update({ status: "published", published_at: new Date().toISOString() })
        .eq("id", slot.contentItemId);
      if (error) throw new Error(`Failed to publish blog: ${error.message}`);
      published++;
    } else {
      const { data: post, error: postError } = await sb
        .from("social_posts")
        .select("id,body")
        .eq("content_item_id", slot.contentItemId)
        .eq("platform", slot.platform)
        .eq("status", "scheduled")
        .limit(1)
        .maybeSingle();
      if (postError) throw new Error(`Failed to find social post: ${postError.message}`);
      if (!post) continue;

      const credential = await loadSocialCredential(sb, ownerId, slot.platform);
      if (credential) {
        const article = snapshot.content.find((c) => c.id === slot.contentItemId);
        const url = article?.slug ? `https://revuvia.app/blog/${article.slug}` : null;
        try {
          const result = await publishToPlatform(credential, post.body, url);
          const { error: upErr } = await sb
            .from("social_posts")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
              external_url: result.externalUrl,
            })
            .eq("id", post.id);
          if (upErr) throw new Error(`Failed to record social publish: ${upErr.message}`);
          socialPublished++;
        } catch (err) {
          // Real publish failed — keep the post scheduled for the next cron retry.
          logger.error("social.publish failed", { platform: slot.platform, error: String(err) });
          continue;
        }
      } else {
        const { error } = await sb
          .from("social_posts")
          .update({ status: "published", published_at: new Date().toISOString() })
          .eq("id", post.id);
        if (error) throw new Error(`Failed to publish social post: ${error.message}`);
        socialPublished++;
      }
      published++;
    }
  }

  return { ok: true, artifacts: { created, published, socialPublished, pending: articles.length } };
}

/** Daily morning cron: founder inbox with today's top 5 (≤ 2 min read). */
export async function runFounderInbox(ownerId = "system"): Promise<ExecutionSummary> {
  const input = await loadGrowthSnapshot(ownerId, 7);
  const snapshot = buildGrowthSnapshot(input);
  const sb = createServiceRoleClient();

  const today = todayLocal();
  const calendar = calendarFromReport(await loadLatestReportData(sb, ownerId, "execution_calendar"));

  const inbox: FounderInbox = buildFounderInbox({
    date: today,
    snapshot,
    calendar: calendar ?? EMPTY_CALENDAR,
  });

  await persistReport(
    sb,
    ownerId,
    "founder_inbox",
    today,
    today,
    [
      `# Founder inbox — ${today} (${inbox.readMinutes} min read)`,
      "",
      "## Today's top 5",
      "",
      ...inbox.priorities.map(
        (p) => `${p.rank}. **[${p.priority}] ${p.title}** (~${p.effortMinutes} min) — ${p.why}`
      ),
      ...(inbox.urgentIssues.length > 0
        ? ["", "## Urgent", "", ...inbox.urgentIssues.map((u) => `- ${u}`)]
        : []),
    ].join("\n"),
    { inbox }
  );

  return { ok: true, artifacts: { priorities: inbox.priorities.length, readMinutes: inbox.readMinutes } };
}
