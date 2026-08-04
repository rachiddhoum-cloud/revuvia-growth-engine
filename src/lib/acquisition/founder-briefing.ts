/**
 * Phase 9 — Founder morning briefing (2-minute read).
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import { loadAcquisitionDashboard } from "@/lib/acquisition/dashboard";
import { loadJourneyFunnel } from "@/lib/acquisition/journey";
import { runCasLearningCycle } from "@/lib/acquisition/learning";
import { formatDailyFounderReport, runRevenueAudit } from "@/lib/acquisition/revenue-audit";
import type { FounderBriefing } from "@/lib/acquisition/types";
import type { Json, ReportType } from "@/types/supabase";

export async function loadFounderBriefing(ownerId?: string): Promise<FounderBriefing> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: cached } = await sb
    .from("reports")
    .select("data")
    .eq("owner_id", owner)
    .eq("type", "founder_inbox")
    .eq("period_start", today)
    .maybeSingle();

  if (cached?.data && typeof cached.data === "object") {
    return cached.data as unknown as FounderBriefing;
  }

  return buildCasFounderBriefing(owner);
}

export async function buildCasFounderBriefing(ownerId?: string): Promise<FounderBriefing> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);
  const yesterdayStart = new Date(Date.now() - 86400_000).toISOString();
  const yesterdayEnd = new Date().toISOString();

  const [dashboard, funnel, visitors, leads, paid, topContent, contentTitles, revenueAudit] =
    await Promise.all([
    loadAcquisitionDashboard(owner),
    loadJourneyFunnel(owner, 7),
    sb
      .from("journey_events")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", owner)
      .eq("stage", "anonymous")
      .gte("occurred_at", yesterdayStart)
      .lte("occurred_at", yesterdayEnd),
    sb
      .from("acquisition_leads")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", owner)
      .gte("created_at", yesterdayStart),
    sb
      .from("journey_events")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", owner)
      .eq("stage", "paid")
      .gte("occurred_at", yesterdayStart),
    sb
      .from("content_roi_snapshots")
      .select("leads, content_item_id")
      .eq("owner_id", owner)
      .order("leads", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from("content_items").select("id, title").eq("owner_id", owner).limit(200),
    runRevenueAudit(owner),
  ]);

  const worstStage = [...funnel.stages]
    .filter((s) => s.stage !== "anonymous" && s.stage !== "cancelled")
    .sort((a, b) => a.conversionRate - b.conversionRate)[0];

  const learning = await runCasLearningCycle(owner);
  const recommendedAction =
    revenueAudit.highestRoiAction.action ||
    learning.recommendations[0] ||
    "Publish one supporting article with a primary CTA.";
  const highestRoiTask =
    revenueAudit.iceActions[0]?.action ??
    (dashboard.topContent[0]?.title != null
      ? `Refresh CTA on "${dashboard.topContent[0].title}"`
      : "Create pillar page: avis Google QR code restaurant");

  const titleMap = new Map((contentTitles.data ?? []).map((c) => [c.id, c.title]));
  const bestArticle =
    topContent.data?.content_item_id != null
      ? titleMap.get(topContent.data.content_item_id) ?? dashboard.topContent[0]?.title ?? null
      : dashboard.topContent[0]?.title ?? null;

  const briefing: FounderBriefing = {
    date: today,
    yesterday: {
      visitors: revenueAudit.kpis.visitors || (visitors.count ?? 0),
      leads: revenueAudit.kpis.leadsCaptured || (leads.count ?? 0),
      paidCustomers: revenueAudit.kpis.paidSubscriptions || (paid.count ?? 0),
    },
    bestArticle,
    worstFunnel: worstStage ? `${worstStage.label} (${worstStage.conversionRate}% conv.)` : null,
    recommendedAction,
    highestRoiTask,
    readMinutes: 2,
    revenue: revenueAudit,
  };

  const dailyMarkdown = formatDailyFounderReport(revenueAudit);

  await Promise.all([
    sb.from("reports").upsert(
      {
        owner_id: owner,
        type: "founder_inbox" as ReportType,
        period_start: today,
        period_end: today,
        markdown: dailyMarkdown,
        html: "",
        email_html: "",
        pdf_ready: "",
        data: briefing as unknown as Json,
        status: "generated",
      },
      { onConflict: "owner_id,type,period_start" }
    ),
    sb.from("reports").upsert(
      {
        owner_id: owner,
        type: "daily_brief" as ReportType,
        period_start: today,
        period_end: today,
        markdown: dailyMarkdown,
        html: "",
        email_html: "",
        pdf_ready: "",
        data: revenueAudit as unknown as Json,
        status: "generated",
      },
      { onConflict: "owner_id,type,period_start" }
    ),
  ]);

  return briefing;
}
