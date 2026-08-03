/**
 * Phase 8 — Autonomous learning: which content/emails/channels convert.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import { todayLocal } from "@/lib/ops/publishing";
import type { Json, ReportType } from "@/types/supabase";

export interface CasLearningInsights {
  periodStart: string;
  periodEnd: string;
  topArticles: { title: string; paidCustomers: number; mrrUsd: number }[];
  topEmails: { templateKey: string; conversions: number }[];
  topChannels: { channel: string; conversions: number }[];
  topIndustries: { industry: string; conversions: number }[];
  topOffers: { offer: string; conversions: number }[];
  recommendations: string[];
}

export async function runCasLearningCycle(ownerId?: string): Promise<CasLearningInsights> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const periodEnd = todayLocal();
  const periodStart = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const [{ data: journey }, { data: nurture }, { data: content }, { data: leads }] = await Promise.all([
    sb
      .from("journey_events")
      .select("stage, channel, content_item_id, revenue_usd")
      .eq("owner_id", owner)
      .gte("occurred_at", `${periodStart}T00:00:00Z`),
    sb
      .from("nurture_events")
      .select("event_type, metadata")
      .eq("owner_id", owner)
      .gte("created_at", `${periodStart}T00:00:00Z`),
    sb.from("content_items").select("id, title").eq("owner_id", owner),
    sb
      .from("acquisition_leads")
      .select("source, status, company")
      .eq("owner_id", owner)
      .gte("created_at", `${periodStart}T00:00:00Z`),
  ]);

  const titleMap = new Map((content ?? []).map((c) => [c.id, c.title]));
  const articlePaid = new Map<string, { title: string; paid: number; mrr: number }>();
  for (const e of journey ?? []) {
    if (e.stage !== "paid" || !e.content_item_id) continue;
    const title = titleMap.get(e.content_item_id) ?? "Unknown";
    const cur = articlePaid.get(e.content_item_id) ?? { title, paid: 0, mrr: 0 };
    cur.paid += 1;
    cur.mrr += Number(e.revenue_usd ?? 39);
    articlePaid.set(e.content_item_id, cur);
  }

  const emailConv = new Map<string, number>();
  for (const e of nurture ?? []) {
    if (e.event_type !== "conversion") continue;
    const meta = e.metadata as { template_key?: string } | null;
    const key = meta?.template_key ?? "unknown";
    emailConv.set(key, (emailConv.get(key) ?? 0) + 1);
  }

  const channelConv = new Map<string, number>();
  for (const e of journey ?? []) {
    if (e.stage !== "paid" || !e.channel) continue;
    channelConv.set(e.channel, (channelConv.get(e.channel) ?? 0) + 1);
  }

  const industryConv = new Map<string, number>();
  const offerConv = new Map<string, number>();
  for (const l of leads ?? []) {
    if (l.status !== "paid") continue;
    const industry = inferIndustry(l.company);
    industryConv.set(industry, (industryConv.get(industry) ?? 0) + 1);
    offerConv.set(l.source ?? "other", (offerConv.get(l.source ?? "other") ?? 0) + 1);
  }

  const topArticles = [...articlePaid.values()]
    .sort((a, b) => b.paid - a.paid)
    .slice(0, 5)
    .map((a) => ({ title: a.title, paidCustomers: a.paid, mrrUsd: a.mrr }));

  const topEmails = [...emailConv.entries()]
    .map(([templateKey, conversions]) => ({ templateKey, conversions }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);

  const topChannels = [...channelConv.entries()]
    .map(([channel, conversions]) => ({ channel, conversions }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);

  const topIndustries = [...industryConv.entries()]
    .map(([industry, conversions]) => ({ industry, conversions }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);

  const topOffers = [...offerConv.entries()]
    .map(([offer, conversions]) => ({ offer, conversions }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, 5);

  const recommendations = buildRecommendations(topArticles, topChannels, topOffers);

  const insights: CasLearningInsights = {
    periodStart,
    periodEnd,
    topArticles,
    topEmails,
    topChannels,
    topIndustries,
    topOffers,
    recommendations,
  };

  await sb.from("reports").upsert(
    {
      owner_id: owner,
      type: "cas_learning" as ReportType,
      period_start: periodStart,
      period_end: periodEnd,
      markdown: recommendations.map((r) => `- ${r}`).join("\n"),
      html: "",
      email_html: "",
      pdf_ready: "",
      data: insights as unknown as Json,
      status: "generated",
    },
    { onConflict: "owner_id,type,period_start" }
  );

  // Snapshot ROI rows for dashboard history
  for (const [contentId, stats] of articlePaid) {
    await sb.from("content_roi_snapshots").insert({
      owner_id: owner,
      content_item_id: contentId,
      period_start: periodStart,
      period_end: periodEnd,
      paid_customers: stats.paid,
      mrr_usd: stats.mrr,
      leads: 0,
    });
  }

  return insights;
}

function inferIndustry(company: string | null): string {
  if (!company) return "unknown";
  const lower = company.toLowerCase();
  if (/caf[eé]|restaurant|hotel|spa|salon|coiff/.test(lower)) return "hospitality";
  if (/clinic|dent|med|pharm/.test(lower)) return "healthcare";
  if (/shop|store|boutique|commerce/.test(lower)) return "retail";
  return "local_business";
}

function buildRecommendations(
  articles: CasLearningInsights["topArticles"],
  channels: CasLearningInsights["topChannels"],
  offers: CasLearningInsights["topOffers"]
): string[] {
  const recs: string[] = [];
  if (articles[0]) {
    recs.push(`Double down on "${articles[0].title}" — ${articles[0].paidCustomers} paid customer(s) this week.`);
  }
  if (channels[0]) {
    recs.push(`Prioritize ${channels[0].channel} outreach — highest conversion channel.`);
  }
  if (offers[0]) {
    recs.push(`Promote offer type "${offers[0].offer}" in next 3 articles.`);
  }
  if (recs.length === 0) {
    recs.push("Publish 2 supporting articles linked to pillar pages and add primary CTAs.");
  }
  return recs;
}
