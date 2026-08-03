/**
 * Growth Operating System — server loader (Sprint 3).
 *
 * Fetches the raw rows needed by the ops generators and builds the weekly
 * `GrowthSnapshot`. Contained errors degrade to an empty snapshot so the
 * dashboard never crashes. Server-only.
 */

import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { weekWindow, type SnapshotInput } from "@/lib/ops/snapshot";
import type { CustomerRow, ProspectRow } from "@/types/supabase";
import type {
  ContentItemRow,
  DailyMetricRow,
  GenerationRunRow,
  PageMetricRow,
} from "@/lib/analytics/aggregate";

export async function loadGrowthSnapshot(
  ownerId?: string,
  days = 7,
  end: Date = new Date()
): Promise<SnapshotInput> {
  const { start, end: endIso } = weekWindow(days, end);
  const empty: SnapshotInput = {
    weekStart: start,
    weekEnd: endIso,
    daily: [],
    pages: [],
    content: [],
    runs: [],
    customers: [],
    prospects: [],
    keywords: [],
  };

  try {
    const sb = await createServerClient();

    const dailyQuery = sb
      .from("daily_metrics")
      .select("metric_date,organic_visits,clicks,impressions,conversions,lead_downloads,revenue")
      .gte("metric_date", start)
      .lte("metric_date", endIso);
    const contentQuery = sb
      .from("content_items")
      .select("id,title,status,quality_score,created_at,slug,excerpt,scheduled_for,published_at")
      .limit(200);
    const customersQuery = sb.from("customers").select("id,owner_id,email,company,industry,status,plan,mrr_usd,last_contact_at,created_at").limit(200);
    const prospectsQuery = sb
      .from("prospects")
      .select("id,owner_id,company,industry,contact_name,email,priority_score,status,last_interaction_at,recommended_message,follow_up_at,probability,notes,created_at,updated_at")
      .limit(100);

    if (typeof ownerId === "string") {
      dailyQuery.eq("owner_id", ownerId);
      contentQuery.eq("owner_id", ownerId);
      customersQuery.eq("owner_id", ownerId);
      prospectsQuery.eq("owner_id", ownerId);
    }

    const [daily, pages, content, runs, customers, prospects] = await Promise.all([
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
        .limit(200)
        .then((r) => r.data ?? []),
      customersQuery.then((r) => r.data ?? []),
      prospectsQuery.then((r) => r.data ?? []),
    ]);

    return {
      weekStart: start,
      weekEnd: endIso,
      daily: daily as DailyMetricRow[],
      pages: pages as PageMetricRow[],
      content: content as ContentItemRow[],
      runs: runs as GenerationRunRow[],
      customers: customers as CustomerRow[],
      prospects: prospects as ProspectRow[],
      keywords: (content as ContentItemRow[]).map((c) => c.title).filter((t): t is string => Boolean(t)).slice(0, 20),
    };
  } catch (error) {
    console.error("[ops] failed to load growth snapshot", error);
    return empty;
  }
}
