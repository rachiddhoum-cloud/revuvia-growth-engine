import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { createServiceRoleClient } from "@/lib/supabase";
import { sendWeeklyReport } from "@/lib/email";
import { MemoryRateLimiter } from "@/lib/reliability";

interface ReportBody {
  recipient?: unknown;
}

/**
 * Sends the weekly SEO report.
 * - Requires the CRON_SECRET header (set via vercel.json cron) or a recipient.
 * - Pulls the last 7 days of daily_metrics from Supabase.
 * - 503 when Resend or recipient is not configured (fail-fast, non-breaking).
 */
export const POST = withRouteHandler<ReportBody>(
  async (body) => {
    if (!process.env.RESEND_API_KEY) {
      throw ApiError.serviceUnavailable("RESEND_API_KEY is not set");
    }
    const recipient =
      (typeof body?.recipient === "string" && body.recipient.trim().length > 0
        ? body.recipient.trim()
        : process.env.REPORT_RECIPIENT_EMAIL) ?? "";
    if (!recipient) {
      throw ApiError.badRequest("REPORT_RECIPIENT_EMAIL is not set and no recipient provided");
    }

    const sb = createServiceRoleClient();
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const { data: metrics, error } = await sb
      .from("daily_metrics")
      .select("*")
      .gte("metric_date", since.toISOString().slice(0, 10));

    if (error) {
      throw new Error(`Failed to load metrics: ${error.message}`);
    }

    const rows = metrics ?? [];
    const total = (key: "organic_visits" | "clicks" | "conversions" | "lead_downloads") =>
      rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);

    const { data: pages, error: pagesError } = await sb
      .from("page_metrics")
      .select("url,visits")
      .order("visits", { ascending: false })
      .limit(5);

    if (pagesError) {
      throw new Error(`Failed to load pages: ${pagesError.message}`);
    }

    const { data: content, error: contentError } = await sb
      .from("content_items")
      .select("published_at")
      .gte("published_at", since.toISOString());

    if (contentError) {
      throw new Error(`Failed to load content: ${contentError.message}`);
    }

    const emailId = await sendWeeklyReport(recipient, {
      weekLabel: since.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      organicVisits: total("organic_visits"),
      clicks: total("clicks"),
      conversions: total("conversions"),
      leadDownloads: total("lead_downloads"),
      publishedCount: content?.length ?? 0,
      topPages: (pages ?? []).map((p) => ({ url: p.url, visits: p.visits ?? 0 })),
      dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/analytics`,
    });

    return NextResponse.json({ ok: true, id: emailId });
  },
  {
    rateLimit: { limiter: new MemoryRateLimiter(5, 60_000) },
    requireCronAuth: true,
  }
);
