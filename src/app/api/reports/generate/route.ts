import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { createServiceRoleClient } from "@/lib/supabase";
import { renderWeeklyReport } from "@/lib/reports";
import type { WeeklyReportData } from "@/types";

interface GenerateBody {
  ownerId?: unknown;
  periodStart?: unknown;
  periodEnd?: unknown;
}

/**
 * Generates + persists the weekly SEO report to the `reports` table.
 * Deterministic render — no email send (see /api/reports/weekly for email).
 * Protected by the CRON_SECRET header (Vercel cron) or an explicit owner.
 */
export const POST = withRouteHandler<GenerateBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const periodStart = typeof body?.periodStart === "string" ? body.periodStart : null;
    const periodEnd = typeof body?.periodEnd === "string" ? body.periodEnd : null;

    const sb = createServiceRoleClient();
    const since = periodStart ? new Date(periodStart) : new Date();
    if (!periodStart) since.setDate(since.getDate() - 7);
    const end = periodEnd ? new Date(periodEnd) : new Date();

    const { data: metrics, error: metricsError } = await sb
      .from("daily_metrics")
      .select("organic_visits,clicks,impressions,conversions,lead_downloads,revenue")
      .gte("metric_date", since.toISOString().slice(0, 10))
      .lte("metric_date", end.toISOString().slice(0, 10));
    if (metricsError) throw new Error(`Failed to load metrics: ${metricsError.message}`);

    const rows = metrics ?? [];
    const sum = (key: "organic_visits" | "clicks" | "impressions" | "conversions" | "lead_downloads" | "revenue") =>
      rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
    const impressions = sum("impressions");
    const clicks = sum("clicks");

    const { data: content, error: contentError } = await sb
      .from("content_items")
      .select("id,title,slug,published_at")
      .gte("published_at", since.toISOString())
      .lte("published_at", end.toISOString());
    if (contentError) throw new Error(`Failed to load content: ${contentError.message}`);

    const { data: pages, error: pagesError } = await sb
      .from("page_metrics")
      .select("url,visits,clicks")
      .order("visits", { ascending: false })
      .limit(5);
    if (pagesError) throw new Error(`Failed to load pages: ${pagesError.message}`);

    const { data: runs, error: runsError } = await sb
      .from("generation_runs")
      .select("module,status,prompt_tokens,completion_tokens,cost_usd")
      .gte("created_at", since.toISOString());
    if (runsError) throw new Error(`Failed to load generation runs: ${runsError.message}`);

    const genRows = runs ?? [];
    const modules: Record<string, number> = {};
    for (const r of genRows) {
      modules[r.module] = (modules[r.module] ?? 0) + 1;
    }

    const report: WeeklyReportData = {
      ownerId,
      periodStart: since.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
      publishedCount: content?.length ?? 0,
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      topKeywords: [],
      topPages: (pages ?? []).map((p) => ({ url: p.url, visits: p.visits ?? 0, clicks: p.clicks ?? 0 })),
      aiProductivity: {
        runs: genRows.length,
        tokens: genRows.reduce((acc, r) => acc + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0), 0),
        costUsd: genRows.reduce((acc, r) => acc + (r.cost_usd ?? 0), 0),
        modules,
      },
      recommendations: [],
    };

    const rendered = renderWeeklyReport(report);
    const { error: insertError } = await sb.from("reports").upsert(
      {
        owner_id: ownerId,
        type: "weekly",
        period_start: report.periodStart,
        period_end: report.periodEnd,
        markdown: rendered.markdown,
        html: rendered.html,
        email_html: rendered.emailHtml,
        pdf_ready: "",
        data: {},
        status: "generated",
      },
      { onConflict: "owner_id,type,period_start" }
    );
    if (insertError) throw new Error(`Failed to persist report: ${insertError.message}`);

    return NextResponse.json({ ok: true, report });
  },
  {
    requireCronAuth: true,
  }
);
