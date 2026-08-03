import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { loadRecommendationInput } from "@/lib/gsc/load";
import { buildGscRecommendations } from "@/lib/gsc/recommendations";
import { toLocalIso, addDays } from "@/lib/gsc/core";
import { recommendationConfidence, evidenceLine } from "@/lib/learning/confidence";
import { toKnowledgeEntry } from "@/lib/learning/server";
import type { ReportType } from "@/types/supabase";
import type { Json } from "@/types/supabase";

interface RecommendationsBody {
  ownerId?: unknown;
}

/** Topic words from a recommendation title (fuzzy knowledge matching). */
function topicFrom(title: string): string {
  return title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zà-ÿ0-9]/gi, ""))
    .filter((w) => w.length > 3)
    .slice(0, 2)
    .join(" ");
}

function recommendationsToMarkdown(recs: ReturnType<typeof buildGscRecommendations>): string {
  const lines = [
    `# GSC Weekly Recommendations �?" ${recs.generatedAt.slice(0, 10)}`,
    ``,
    `## SEO Health: ${recs.health.total}/100 (${recs.health.trend})`,
    ...Object.entries(recs.health.dimensions)
      .map(([k, v]) => `- ${k}: ${v}`)
      .sort(),
    ``,
    `## Pages losing traffic`,
    ...recs.losingPages.map((p) => `- ${p.url}: ${p.previousClicks} ��' ${p.clicks} clicks`),
    ``,
    `## Pages winning traffic`,
    ...recs.winningPages.map((p) => `- ${p.url}: ${p.previousClicks} ��' ${p.clicks} clicks`),
    ``,
    `## Rising queries`,
    ...recs.risingQueries.map((q) => `- "${q.query}": ${q.impressions} impressions, position ${q.position}`),
    ``,
    `## Falling queries`,
    ...recs.fallingQueries.map((q) => `- "${q.query}": position ${q.previousPosition} ��' ${q.position}`),
    ``,
    `## Quick wins`,
    ...recs.quickWins.map((q) => {
      const m = q.confidenceModel;
      const evidence = m && m.evidence.length > 0 ? ` · ${m.evidence[0]}` : "";
      const model = m ? ` — ${Math.round(m.confidence * 100)}% conf · ~${m.expectedTraffic} visits · +$${m.expectedRoiUsd} ROI` : "";
      return `- [${q.priority}] ${q.title} (ICE ${q.ice})${model}${evidence}`;
    }),
    ``,
    `## Content roadmap`,
    ...recs.contentRoadmap.map((c) => `- [${c.priority}] ${c.title} (ICE ${c.ice})`),
    ``,
    `## Linking intelligence (${recs.linkingIntel.length} suggestions)`,
    ...recs.linkingIntel.map((l) => `- [${l.priority}] ${l.title} (ICE ${l.ice})`),
    ``,
    `## 12-week forecast`,
    ...recs.forecast.map((f) => `- Week ${f.week}: ${f.organicVisits} organic visits, $${f.mrrUsd} MRR`),
    ``,
    ...recs.forecastAssumptions.map((a) => `> ${a}`),
  ];
  return lines.join("\n");
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

/** POST /api/gsc/recommendations — weekly: SEO health + CEO recommendations report. */
export const POST = withRouteHandler<RecommendationsBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const sb = createServiceRoleClient();
    const input = await loadRecommendationInput(ownerId);
    const recs = buildGscRecommendations(input);

    const { data: kbRows } = await sb
      .from("knowledge_base")
      .select("strategy_type,key,confidence,attempts,successes,failures,metrics,uplift_pct,evidence,learned_at")
      .eq("owner_id", ownerId);
    if (kbRows === null) throw new Error("Failed to load knowledge base");
    const knowledge = kbRows.map(toKnowledgeEntry);

    const enriched: typeof recs = {
      ...recs,
      quickWins: recs.quickWins.map((q) => {
        const opportunity = recs.opportunities.find((o) => `quick-${o.id}` === q.id);
        return {
          ...q,
          confidenceModel: recommendationConfidence({
            strategyType: "keyword_cluster",
            topic: topicFrom(q.title),
            baseImpact: Math.max(3, Math.round(q.ice / 100)),
            baseEase: 6,
            knowledge,
            baselineTraffic: opportunity?.expectedTrafficGain,
            acvUsd: input.acvUsd,
            conversionRate: input.conversionRate,
          }),
        };
      }),
    };

    const topKnowledge = [...knowledge].sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    const markdown = [
      recommendationsToMarkdown(enriched),
      "",
      "## Learning evidence (knowledge base)",
      ...(topKnowledge.length > 0
        ? topKnowledge.map((k) => `- ${evidenceLine(k)}`)
        : ["- No learned patterns yet — the Monday learning cycle builds these."]),
    ].join("\n");

    const today = toLocalIso(new Date());
    const weekStart = addDays(today, -6);

    await persistReport(sb, ownerId, "gsc_recommendations", weekStart, today, markdown, enriched);
    await persistReport(sb, ownerId, "seo_health", weekStart, today, `# SEO Health: ${enriched.health.total}/100`, {
      total: enriched.health.total,
      dimensions: enriched.health.dimensions,
      trend: enriched.health.trend,
    });

    return NextResponse.json({
      ok: true,
      health: enriched.health.total,
      trend: enriched.health.trend,
      opportunities: enriched.opportunities.length,
      quickWins: enriched.quickWins.length,
      contentRoadmap: enriched.contentRoadmap.length,
      linkingIntel: enriched.linkingIntel.length,
      forecast: enriched.forecast,
      learning: {
        knowledgeEntries: knowledge.length,
        evidenceApplied: enriched.quickWins.filter((q) => (q.confidenceModel?.evidence.length ?? 0) > 0).length,
        topPattern: topKnowledge[0] ? `${topKnowledge[0].key} (${Math.round(topKnowledge[0].confidence * 100)}% conf)` : null,
      },
    });
  },
  {
    requireCronAuth: true,
  }
);
