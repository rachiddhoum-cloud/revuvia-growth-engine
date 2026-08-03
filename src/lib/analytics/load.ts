/**
 * Analytics data loader (server-only).
 *
 * Fetches the raw rows for the dashboard (daily_metrics, page_metrics,
 * content_items, generation_runs) and builds the AnalyticsModel via the pure
 * aggregation module. Errors are contained so the dashboard degrades to empty
 * instead of crashing when metrics aren't wired up yet.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { buildAnalyticsModel, type AnalyticsModel } from "@/lib/analytics/aggregate";

const DAYS = 30;

export async function loadAnalyticsModel(ownerId?: string): Promise<AnalyticsModel> {
  try {
    const sb = await createServerClient();

    const dailyQuery = sb
      .from("daily_metrics")
      .select("metric_date,organic_visits,clicks,impressions,conversions,lead_downloads,revenue")
      .order("metric_date", { ascending: false })
      .limit(90);
    const contentQuery = sb.from("content_items").select("id,title,status,quality_score,created_at").limit(200);
    if (typeof ownerId === "string") {
      dailyQuery.eq("owner_id", ownerId);
      contentQuery.eq("owner_id", ownerId);
    }

    const [daily, pages, content, runs] = await Promise.all([
      dailyQuery.then((r) => r.data ?? []),
      sb
        .from("page_metrics")
        .select("url,visits,clicks,impressions,ctr,avg_position")
        .limit(50)
        .then((r) => r.data ?? []),
      contentQuery.then((r) => r.data ?? []),
      sb
        .from("generation_runs")
        .select("module,status,cost_usd,created_at")
        .order("created_at", { ascending: false })
        .limit(200)
        .then((r) => r.data ?? []),
    ]);

    return buildAnalyticsModel({ daily, pages, content, runs, days: DAYS });
  } catch (error) {
    console.error("[analytics] failed to load model", error);
    return buildAnalyticsModel({ daily: [], pages: [], content: [], runs: [], days: DAYS });
  }
}
