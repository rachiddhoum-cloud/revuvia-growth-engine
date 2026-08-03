import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { createServiceRoleClient } from "@/lib/supabase";
import { runJob, SupabaseJobStore } from "@/lib/jobs";
import type { JobDefinition, JobResult } from "@/lib/jobs";
import { renderWeeklyReport } from "@/lib/reports";
import type { WeeklyReportData } from "@/types";

interface RunBody {
  jobId?: unknown;
  ownerId?: unknown;
  maxAttempts?: unknown;
}

const JOB_HANDLERS: Record<string, (ctx: { jobId: string; attempt: number }) => Promise<JobResult>> = {
  /** Generates + persists the weekly report for the owner. */
  weekly_report: async () => {
    const sb = createServiceRoleClient();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: metrics, error: metricsError } = await sb
      .from("daily_metrics")
      .select("organic_visits,clicks,impressions,conversions")
      .gte("metric_date", since.toISOString().slice(0, 10));
    if (metricsError) throw new Error(`Failed to load metrics: ${metricsError.message}`);

    const rows = metrics ?? [];
    const sum = (key: "organic_visits" | "clicks" | "impressions" | "conversions") =>
      rows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
    const impressions = sum("impressions");
    const clicks = sum("clicks");

    const { data: content, error: contentError } = await sb
      .from("content_items")
      .select("id,published_at,title,slug")
      .gte("published_at", since.toISOString());
    if (contentError) throw new Error(`Failed to load content: ${contentError.message}`);

    const report: WeeklyReportData = {
      ownerId: "system",
      periodStart: since.toISOString().slice(0, 10),
      periodEnd: new Date().toISOString().slice(0, 10),
      publishedCount: content?.length ?? 0,
      impressions,
      clicks,
      ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      topKeywords: [],
      topPages: [],
      aiProductivity: { runs: 0, tokens: 0, costUsd: 0, modules: {} },
      recommendations: [],
    };

    const rendered = renderWeeklyReport(report);
    const { error: insertError } = await sb.from("reports").insert({
      owner_id: report.ownerId,
      type: "weekly",
      period_start: report.periodStart,
      period_end: report.periodEnd,
      markdown: rendered.markdown,
      html: rendered.html,
      email_html: rendered.emailHtml,
      pdf_ready: "",
      data: {},
      status: "generated",
    });
    if (insertError) throw new Error(`Failed to persist report: ${insertError.message}`);

    return { ok: true, message: `Weekly report generated (${report.publishedCount} articles)` };
  },
};

/**
 * Runs a registered job by id via the retry-safe runner.
 * Protected by the CRON_SECRET header (Vercel cron).
 */
export const POST = withRouteHandler<RunBody>(
  async (body) => {
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    if (!jobId) {
      throw ApiError.badRequest("jobId is required");
    }

    const sb = createServiceRoleClient();
    const store = new SupabaseJobStore(sb);
    const base = await store.getJob(jobId);
    if (!base) {
      throw ApiError.badRequest(`Job ${jobId} not found`);
    }

    const handler = JOB_HANDLERS[base.name];
    if (!handler) {
      throw ApiError.badRequest(`No handler registered for job "${base.name}"`);
    }

    const job: JobDefinition = {
      ...base,
      handler: (ctx) => handler({ jobId: ctx.jobId, attempt: ctx.attempt }),
    };

    const maxAttempts =
      typeof body?.maxAttempts === "number" && body.maxAttempts >= 1 ? body.maxAttempts : undefined;

    const outcome = await runJob(job, store, maxAttempts ? { maxAttempts } : {});
    return NextResponse.json({ ok: outcome.status === "completed", outcome });
  },
  {
    rateLimit: { limiter: { consume: () => ({ ok: true } as never) } as never },
    requireCronAuth: true,
  }
);
