/**
 * Phase 1 — SEO Content Hub loader.
 * Aggregates keywords, clusters, pillar/supporting pages and ROI estimates.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import type { ContentHubRow } from "@/lib/acquisition/types";

export interface ContentHubModel {
  rows: ContentHubRow[];
  summary: {
    totalKeywords: number;
    pillars: number;
    supporting: number;
    published: number;
    expectedLeads: number;
    expectedMrrUsd: number;
  };
}

export async function loadContentHub(ownerId?: string): Promise<ContentHubModel> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();

  const { data: projects } = await sb.from("seo_projects").select("id").eq("owner_id", owner).limit(1);
  const projectId = projects?.[0]?.id;
  if (!projectId) {
    return emptyHub();
  }

  const [{ data: keywords, error: kwError }, { data: contentRows }] = await Promise.all([
    sb
      .from("keywords")
      .select(
        "id, keyword, volume, difficulty, intent, content_status, page_role, traffic_estimate, expected_leads, expected_mrr, priority, opportunity_score, cluster_id, content_item_id"
      )
      .eq("project_id", projectId)
      .is("archived_at", null)
      .order("priority", { ascending: true })
      .limit(500),
    sb.from("content_items").select("id, keyword_id, title, slug").eq("owner_id", owner),
  ]);

  if (kwError) {
    console.error("[cas] content hub load failed", kwError);
    return emptyHub();
  }

  const clusterIds = [...new Set((keywords ?? []).map((k) => k.cluster_id).filter(Boolean))] as string[];
  const { data: clusters } = clusterIds.length
    ? await sb.from("keyword_clusters").select("id, name").in("id", clusterIds)
    : { data: [] as { id: string; name: string }[] };

  const clusterMap = new Map((clusters ?? []).map((c) => [c.id, c.name]));
  const contentByKeyword = new Map(
    (contentRows ?? [])
      .filter((c) => c.keyword_id)
      .map((c) => [c.keyword_id as string, { title: c.title, slug: c.slug, id: c.id }])
  );
  const contentById = new Map((contentRows ?? []).map((c) => [c.id, { title: c.title, slug: c.slug }]));

  const rows: ContentHubRow[] = (keywords ?? []).map((k) => {
    const linked =
      (k.content_item_id ? contentById.get(k.content_item_id) : null) ??
      contentByKeyword.get(k.id) ??
      null;
    return {
      id: k.id,
      keyword: k.keyword,
      cluster_name: k.cluster_id ? (clusterMap.get(k.cluster_id) ?? null) : null,
      volume: k.volume ?? 0,
      difficulty: k.difficulty ?? 0,
      intent: k.intent,
      content_status: (k.content_status ?? "planned") as ContentHubRow["content_status"],
      page_role: (k.page_role ?? "none") as ContentHubRow["page_role"],
      traffic_estimate: k.traffic_estimate ?? 0,
      expected_leads: k.expected_leads ?? 0,
      expected_mrr: Number(k.expected_mrr ?? 0),
      priority: k.priority ?? 0,
      opportunity_score: Number(k.opportunity_score ?? 0),
      content_title: linked?.title ?? null,
      content_slug: linked?.slug ?? null,
    };
  });

  return {
    rows,
    summary: {
      totalKeywords: rows.length,
      pillars: rows.filter((r) => r.page_role === "pillar").length,
      supporting: rows.filter((r) => r.page_role === "supporting").length,
      published: rows.filter((r) => r.content_status === "published").length,
      expectedLeads: rows.reduce((s, r) => s + r.expected_leads, 0),
      expectedMrrUsd: rows.reduce((s, r) => s + r.expected_mrr, 0),
    },
  };
}

function emptyHub(): ContentHubModel {
  return {
    rows: [],
    summary: {
      totalKeywords: 0,
      pillars: 0,
      supporting: 0,
      published: 0,
      expectedLeads: 0,
      expectedMrrUsd: 0,
    },
  };
}
