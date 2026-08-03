/**
 * Phase 5 — Weekly SEO intelligence loop.
 * Finds keywords, gaps, competitor moves and generates brief priorities.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import { todayLocal } from "@/lib/ops/publishing";
import type { Json, ReportType } from "@/types/supabase";

export interface SeoIntelligenceReport {
  periodStart: string;
  periodEnd: string;
  newKeywords: { keyword: string; volume: number; intent: string | null }[];
  contentGaps: { keyword: string; priority: number; reason: string }[];
  competitorMoves: { domain: string; notes: string }[];
  articleBriefs: { keyword: string; title: string; pageRole: string; priority: number }[];
  archivedKeywords: string[];
  priorityUpdates: { keyword: string; newPriority: number }[];
}

export async function runSeoIntelligenceCycle(ownerId?: string): Promise<SeoIntelligenceReport> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();
  const periodEnd = todayLocal();
  const periodStart = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const { data: projects } = await sb.from("seo_projects").select("id").eq("owner_id", owner).limit(1);
  const projectId = projects?.[0]?.id;
  if (!projectId) {
    return emptyReport(periodStart, periodEnd);
  }

  const [{ data: keywords }, { data: competitors }, { data: gscQueries }] = await Promise.all([
    sb
      .from("keywords")
      .select("id, keyword, volume, intent, priority, content_status, page_role, opportunity_score, archived_at")
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("opportunity_score", { ascending: false })
      .limit(200),
    sb.from("competitors").select("domain, notes, keyword_overlap").eq("project_id", projectId),
    sb
      .from("search_console_queries")
      .select("query, clicks, impressions")
      .eq("owner_id", owner)
      .gte("date", periodStart)
      .order("clicks", { ascending: false })
      .limit(30),
  ]);

  const existing = new Set((keywords ?? []).map((k) => k.keyword.toLowerCase()));
  const newKeywords = (gscQueries ?? [])
    .filter((q) => !existing.has(q.query.toLowerCase()) && (q.impressions ?? 0) >= 20)
    .slice(0, 10)
    .map((q) => ({ keyword: q.query, volume: q.impressions ?? 0, intent: inferIntent(q.query) }));

  const contentGaps = (keywords ?? [])
    .filter((k) => k.content_status === "planned" && (k.opportunity_score ?? 0) >= 50)
    .slice(0, 10)
    .map((k) => ({
      keyword: k.keyword,
      priority: k.priority ?? 0,
      reason: `High opportunity (${k.opportunity_score}) — no content yet`,
    }));

  const competitorMoves = (competitors ?? []).map((c) => ({
    domain: c.domain,
    notes: c.notes ?? "Monitor SERP overlap weekly",
  }));

  const articleBriefs = (keywords ?? [])
    .filter((k) => ["planned", "brief"].includes(k.content_status ?? "planned"))
    .slice(0, 8)
    .map((k) => ({
      keyword: k.keyword,
      title: briefTitle(k.keyword),
      pageRole: k.page_role === "pillar" ? "pillar" : "supporting",
      priority: k.priority ?? 0,
    }));

  const archivedKeywords: string[] = [];
  const stale = (keywords ?? []).filter(
    (k) => (k.volume ?? 0) < 10 && (k.opportunity_score ?? 0) < 20 && k.content_status === "planned"
  );
  for (const k of stale.slice(0, 5)) {
    await sb.from("keywords").update({ archived_at: new Date().toISOString(), content_status: "archived" }).eq("id", k.id);
    archivedKeywords.push(k.keyword);
  }

  for (const nk of newKeywords) {
    await sb.from("keywords").insert({
      project_id: projectId,
      keyword: nk.keyword,
      volume: nk.volume,
      intent: nk.intent,
      content_status: "brief",
      page_role: "supporting",
      priority: 50,
      opportunity_score: Math.min(80, Math.round(nk.volume / 10)),
      traffic_estimate: Math.round(nk.volume * 0.3),
      expected_leads: Math.max(1, Math.round(nk.volume * 0.002)),
      expected_mrr: Math.max(39, Math.round(nk.volume * 0.002 * 39)),
    });
  }

  const priorityUpdates = (keywords ?? [])
    .filter((k) => (k.opportunity_score ?? 0) >= 70)
    .slice(0, 5)
    .map((k) => ({ keyword: k.keyword, newPriority: Math.max(1, (k.priority ?? 99) - 5) }));

  for (const u of priorityUpdates) {
    const row = (keywords ?? []).find((k) => k.keyword === u.keyword);
    if (row) await sb.from("keywords").update({ priority: u.newPriority }).eq("id", row.id);
  }

  const report: SeoIntelligenceReport = {
    periodStart,
    periodEnd,
    newKeywords,
    contentGaps,
    competitorMoves,
    articleBriefs,
    archivedKeywords,
    priorityUpdates,
  };

  await sb.from("reports").upsert(
    {
      owner_id: owner,
      type: "seo_intelligence_weekly" as ReportType,
      period_start: periodStart,
      period_end: periodEnd,
      markdown: articleBriefs.map((b) => `- ${b.title} (${b.keyword})`).join("\n"),
      html: "",
      email_html: "",
      pdf_ready: "",
      data: report as unknown as Json,
      status: "generated",
    },
    { onConflict: "owner_id,type,period_start" }
  );

  return report;
}

function inferIntent(query: string): string {
  const lower = query.toLowerCase();
  if (/buy|price|trial|software|tool|app/.test(lower)) return "commercial";
  if (/near me|agadir|maroc|morocco/.test(lower)) return "transactional";
  if (/how|what|why|guide|template/.test(lower)) return "informational";
  return "informational";
}

function briefTitle(keyword: string): string {
  const cap = keyword.charAt(0).toUpperCase() + keyword.slice(1);
  return `${cap} — guide complet pour les commerces locaux`;
}

function emptyReport(start: string, end: string): SeoIntelligenceReport {
  return {
    periodStart: start,
    periodEnd: end,
    newKeywords: [],
    contentGaps: [],
    competitorMoves: [],
    articleBriefs: [],
    archivedKeywords: [],
    priorityUpdates: [],
  };
}
