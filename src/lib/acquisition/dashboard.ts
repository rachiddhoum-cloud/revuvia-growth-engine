/**
 * Phase 7 — Founder acquisition dashboard (traffic → MRR → ROI).
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import { loadGrowthSnapshot } from "@/lib/ops/load";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";
import { loadContentHub } from "@/lib/acquisition/content-hub";
import { loadNurtureMetrics } from "@/lib/acquisition/nurture";
import type { CasDashboardModel } from "@/lib/acquisition/types";
import type { Json, ReportType } from "@/types/supabase";

const REVUVIA_MRR_USD = 39;

export async function loadAcquisitionDashboard(ownerId?: string): Promise<CasDashboardModel> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();

  const [
    snapshotInput,
    hub,
    nurture,
    leadsWeek,
    leadsTotal,
    paidLeads,
    ctaConversions,
    ctaDefs,
    roiRows,
    leadSources,
    contentItems,
  ] = await Promise.all([
      loadGrowthSnapshot(owner, 7),
      loadContentHub(owner),
      loadNurtureMetrics(owner),
      sb
        .from("acquisition_leads")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", owner)
        .gte("created_at", weekAgo()),
      sb.from("acquisition_leads").select("id", { count: "exact", head: true }).eq("owner_id", owner),
      sb
        .from("acquisition_leads")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", owner)
        .eq("status", "paid"),
      sb
        .from("cta_conversions")
        .select("cta_id, event_type")
        .eq("owner_id", owner)
        .gte("created_at", weekAgo()),
      sb.from("content_ctas").select("id, label").eq("owner_id", owner),
      sb
        .from("content_roi_snapshots")
        .select("content_item_id, leads, mrr_usd")
        .eq("owner_id", owner)
        .order("period_start", { ascending: false })
        .limit(50),
      sb.from("acquisition_leads").select("source, status").eq("owner_id", owner),
      sb.from("content_items").select("id, title").eq("owner_id", owner),
    ]);

  const snapshot = buildGrowthSnapshot(snapshotInput);
  const weeklyVisits = snapshot.weekly.visits;
  const prevVisits = snapshot.previous.visits;
  const deltaPct =
    prevVisits > 0 ? Math.round(((weeklyVisits - prevVisits) / prevVisits) * 1000) / 10 : 0;

  const totalLeads = leadsTotal.count ?? 0;
  const weekLeads = leadsWeek.count ?? 0;
  const paidCount = paidLeads.count ?? 0;
  const mrrUsd = paidCount * REVUVIA_MRR_USD;
  const conversionRate = weeklyVisits > 0 ? Math.round((weekLeads / weeklyVisits) * 1000) / 10 : 0;

  const ctaMap = new Map<string, { label: string; clicks: number; conversions: number }>();
  const ctaLabels = new Map((ctaDefs.data ?? []).map((c) => [c.id, c.label]));
  for (const row of ctaConversions.data ?? []) {
    const label = (row.cta_id ? ctaLabels.get(row.cta_id) : null) ?? "Unknown CTA";
    const key = row.cta_id ?? label;
    const cur = ctaMap.get(key) ?? { label, clicks: 0, conversions: 0 };
    if (row.event_type === "click") cur.clicks += 1;
    if (row.event_type === "conversion") cur.conversions += 1;
    ctaMap.set(key, cur);
  }

  const titleById = new Map((contentItems.data ?? []).map((c) => [c.id, c.title]));

  const contentMap = new Map<string, { title: string; leads: number; mrrUsd: number }>();
  for (const row of roiRows.data ?? []) {
    const title = (row.content_item_id ? titleById.get(row.content_item_id) : null) ?? "Untitled";
    const key = row.content_item_id ?? title;
    const cur = contentMap.get(key) ?? { title, leads: 0, mrrUsd: 0 };
    cur.leads += row.leads ?? 0;
    cur.mrrUsd += Number(row.mrr_usd ?? 0);
    contentMap.set(key, cur);
  }

  const channelMap = new Map<string, number>();
  for (const l of leadSources.data ?? []) {
    if (l.status !== "paid" && l.status !== "trial" && l.status !== "registered") continue;
    const src = l.source ?? "other";
    channelMap.set(src, (channelMap.get(src) ?? 0) + 1);
  }

  const spendUsd = snapshot.weekly.aiCostUsd + 50; // baseline ops spend estimate
  const cacEstimateUsd = paidCount > 0 ? Math.round(spendUsd / paidCount) : 0;
  const roiEstimate = spendUsd > 0 ? Math.round(((mrrUsd * 12) / spendUsd) * 100) / 100 : 0;

  const model: CasDashboardModel = {
    traffic: { weekly: weeklyVisits, deltaPct },
    seo: {
      keywords: hub.summary.totalKeywords,
      published: hub.summary.published,
      pillars: hub.summary.pillars,
    },
    leads: { total: totalLeads, thisWeek: weekLeads, conversionRate },
    email: {
      sent: nurture.sent,
      openRate: nurture.openRate,
      clickRate: nurture.clickRate,
      unsubscribeRate: nurture.unsubscribeRate,
    },
    revenue: { mrrUsd, paidCustomers: paidCount, cacEstimateUsd, roiEstimate },
    topContent: [...contentMap.values()].sort((a, b) => b.leads - a.leads).slice(0, 5),
    topCta: [...ctaMap.values()].sort((a, b) => b.conversions - a.conversions).slice(0, 5),
    topEmail: [],
    topChannel: [...channelMap.entries()]
      .map(([channel, conversions]) => ({ channel, conversions }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 5),
  };

  await persistCasDashboard(sb, owner, model);
  return model;
}

function weekAgo(): string {
  return new Date(Date.now() - 7 * 86400_000).toISOString();
}

async function persistCasDashboard(
  sb: ReturnType<typeof createServiceRoleClient>,
  ownerId: string,
  model: CasDashboardModel
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await sb.from("reports").upsert(
    {
      owner_id: ownerId,
      type: "cas_dashboard" as ReportType,
      period_start: today,
      period_end: today,
      markdown: `# CAS Dashboard ${today}`,
      html: "",
      email_html: "",
      pdf_ready: "",
      data: model as unknown as Json,
      status: "generated",
    },
    { onConflict: "owner_id,type,period_start" }
  );
}
