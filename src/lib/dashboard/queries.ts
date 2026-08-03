import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

export interface DashboardSummary {
  totalArticles: number;
  publishedArticles: number;
  totalKeywords: number;
  rankingKeywords: number;
  totalDownloads: number;
  organicVisits: number;
  conversions: number;
  monthlyGrowth: number; // % organic_visits month-over-month
  topPages: Array<{ url: string; visits: number; ctr: number }>;
}

type DbClient = SupabaseClient<Database>;

/** Aggregate dashboard metrics for an owner. */
export async function getDashboardSummary(
  sb: DbClient,
  ownerId: string
): Promise<DashboardSummary> {
  const [content, metrics, pages] = await Promise.all([
    sb.from("content_items").select("id,status").eq("owner_id", ownerId),
    sb
      .from("daily_metrics")
      .select("*")
      .eq("owner_id", ownerId)
      .order("metric_date", { ascending: false })
      .limit(90),
    sb
      .from("page_metrics")
      .select("*")
      .eq("owner_id", ownerId)
      .order("visits", { ascending: false })
      .limit(8),
  ]);

  const contentRows = content.data ?? [];
  const metricsRows = metrics.data ?? [];
  const totalOrganic = metricsRows.reduce((s, m) => s + (m.organic_visits ?? 0), 0);
  const totalConversions = metricsRows.reduce((s, m) => s + (m.conversions ?? 0), 0);
  const totalDownloads = metricsRows.reduce((s, m) => s + (m.lead_downloads ?? 0), 0);

  // month-over-month growth
  let monthlyGrowth = 0;
  if (metricsRows.length >= 2) {
    const groups = new Map<string, number>();
    for (const row of metricsRows) {
      const key = new Date(row.metric_date).toISOString().slice(0, 7);
      groups.set(key, (groups.get(key) ?? 0) + (row.organic_visits ?? 0));
    }
    const keys = [...groups.keys()].sort();
    if (keys.length >= 2) {
      const prev = groups.get(keys[keys.length - 2]) ?? 0;
      const last = groups.get(keys[keys.length - 1]) ?? 0;
      if (prev > 0) monthlyGrowth = Math.round(((last - prev) / prev) * 100);
    }
  }

  const projectId = await firstProjectId(sb, ownerId);
  let rankingKeywords = 0;
  if (projectId) {
    const { data } = await sb
      .from("keywords")
      .select("id")
      .eq("project_id", projectId)
      .limit(200);
    const ids = (data ?? []).map((k) => k.id);
    if (ids.length) {
      const { count } = await sb
        .from("rank_snapshots")
        .select("id", { count: "exact", head: true })
        .in("keyword_id", ids);
      rankingKeywords = count ?? 0;
    }
  }

  return {
    totalArticles: contentRows.length,
    publishedArticles: contentRows.filter((c) => c.status === "published").length,
    totalKeywords: 0,
    rankingKeywords,
    totalDownloads,
    organicVisits: totalOrganic,
    conversions: totalConversions,
    monthlyGrowth,
    topPages: (pages.data ?? [])
      .slice(0, 5)
      .map((p) => ({ url: p.url, visits: p.visits ?? 0, ctr: p.ctr ?? 0 })),
  };
}

async function firstProjectId(sb: DbClient, ownerId: string): Promise<string | null> {
  const { data } = await sb
    .from("seo_projects")
    .select("id")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })
    .limit(1);
  return data?.[0]?.id ?? null;
}
