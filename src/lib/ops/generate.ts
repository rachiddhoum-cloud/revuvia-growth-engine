/**
 * Ops artifact generator (shared, server-side).
 *
 * Three artifacts, one implementation. The cron routes (`/api/ops/plan`,
 * `/api/ops/brief`, `/api/ops/report`) each call `generateOpsArtifact`.
 * Persistence is idempotent on `(owner_id, type, period_start)`.
 */

import { createServiceRoleClient } from "@/lib/supabase";
import type { Json } from "@/types/supabase";
import { loadGrowthSnapshot } from "@/lib/ops/load";
import { buildGrowthSnapshot } from "@/lib/ops/snapshot";
import {
  buildActionPlan,
  buildCeoReport,
  buildContentQueue,
  buildDailyBrief,
  buildSalesPlan,
  buildSeoMissions,
  briefToMarkdown,
  ceoReportToHtml,
  ceoReportToMarkdown,
  defaultCandidates,
} from "@/lib/ops";
import type { CeoReportData } from "@/lib/ops";

export type OpsArtifact = "action_plan" | "daily_brief" | "ceo_report";

export interface GenerateResult {
  ok: boolean;
  artifact: OpsArtifact;
  summary: Record<string, unknown>;
}

export async function generateOpsArtifact(
  artifact: OpsArtifact,
  ownerId = "system"
): Promise<GenerateResult> {
  const input = await loadGrowthSnapshot(ownerId, 7);
  const snapshot = buildGrowthSnapshot(input);
  const periodStart = snapshot.weekStart;
  const nowIso = new Date().toISOString();

  const sb = createServiceRoleClient();

  if (artifact === "daily_brief") {
    const fallbackPlan = buildActionPlan({
      snapshot,
      contentQueue: buildContentQueue(defaultCandidates(snapshot), snapshot).queue,
      seoMissions: buildSeoMissions(snapshot),
      salesPlan: buildSalesPlan({ prospects: snapshot.prospects }),
    });
    const brief = buildDailyBrief({ snapshot, actionPlan: fallbackPlan });
    const markdown = briefToMarkdown(brief);

    const { error } = await sb.from("reports").upsert(
      {
        owner_id: ownerId,
        type: "daily_brief",
        period_start: periodStart,
        period_end: snapshot.weekEnd,
        markdown,
        html: markdown,
        email_html: "",
        pdf_ready: "",
        data: { brief } as unknown as Json,
        status: "generated",
      },
      { onConflict: "owner_id,type,period_start" }
    );
    if (error) throw new Error(`Failed to persist daily brief: ${error.message}`);

    return { ok: true, artifact, summary: { date: brief.date } };
  }

  if (artifact === "ceo_report") {
    const contentQueue = buildContentQueue(defaultCandidates(snapshot), snapshot).queue;
    const seoMissions = buildSeoMissions(snapshot);
    const salesPlan = buildSalesPlan({ prospects: snapshot.prospects });
    const actionPlan = buildActionPlan({ snapshot, contentQueue, seoMissions, salesPlan });
    const reportData: CeoReportData = buildCeoReport({ snapshot, actionPlan, salesPlan });
    const markdown = ceoReportToMarkdown(reportData);
    const html = ceoReportToHtml(reportData);

    const { error } = await sb.from("reports").upsert(
      {
        owner_id: ownerId,
        type: "ceo",
        period_start: periodStart,
        period_end: snapshot.weekEnd,
        markdown,
        html,
        email_html: "",
        pdf_ready: html,
        data: { report: reportData } as unknown as Json,
        status: "generated",
      },
      { onConflict: "owner_id,type,period_start" }
    );
    if (error) throw new Error(`Failed to persist CEO report: ${error.message}`);

    return { ok: true, artifact, summary: { mrrUsd: reportData.mrrUsd, paidCustomers: reportData.paidCustomers } };
  }

  // action_plan: full weekly bundle.
  const contentQueue = buildContentQueue(defaultCandidates(snapshot), snapshot).queue;
  const seoMissions = buildSeoMissions(snapshot);
  const salesPlan = buildSalesPlan({ prospects: snapshot.prospects });
  const actionPlan = buildActionPlan({ snapshot, contentQueue, seoMissions, salesPlan });

  const planMarkdown = [
    `# Weekly Action Plan — ${periodStart} to ${snapshot.weekEnd}`,
    "",
    `Generated ${nowIso.slice(0, 10)} · revenue forecast +$${actionPlan.revenueForecastUsd}`,
    "",
    "## TOP 10 actions",
    "",
    ...actionPlan.actions.map(
      (a, i) =>
        `${i + 1}. **[${a.priority}] ${a.title}** — ICE ${a.ice.toFixed(1)} · impact ${a.impact}/10 · effort ${a.ease}/10 · +$${a.mrrImpactUsd} MRR`
    ),
    "",
    "## Sales command center",
    "",
    ...(salesPlan.length > 0
      ? salesPlan.map((p) => `- ${p.company} (${p.industry ?? "n/a"}) · ${p.status} · follow up ${p.followUpAt} · ${Math.round(p.probability * 100)}%`)
      : ["- No prospects yet — add rows to `prospects`."]),
    "",
    "## SEO missions",
    "",
    ...seoMissions.map((m) => `- ${m.title} (ICE ${m.ice.toFixed(1)})`),
    "",
    "## Content queue",
    "",
    ...contentQueue.map((c) => `- ${c.title} (~$${c.aiCostUsd.toFixed(2)})`),
  ].join("\n");

  const { error } = await sb.from("reports").upsert(
    {
      owner_id: ownerId,
      type: "action_plan",
      period_start: periodStart,
      period_end: snapshot.weekEnd,
      markdown: planMarkdown,
      html: `<pre>${planMarkdown.replace(/</g, "&lt;")}</pre>`,
      email_html: "",
      pdf_ready: "",
      data: { actions: actionPlan.actions, salesPlan, seoMissions, contentQueue } as unknown as Json,
      status: "generated",
    },
    { onConflict: "owner_id,type,period_start" }
  );
  if (error) throw new Error(`Failed to persist action plan: ${error.message}`);

  return {
    ok: true,
    artifact,
    summary: { actions: actionPlan.actions.length, revenueForecastUsd: actionPlan.revenueForecastUsd },
  };
}
