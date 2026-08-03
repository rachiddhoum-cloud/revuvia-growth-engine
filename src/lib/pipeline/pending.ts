/**
 * Pending human-approval queue for the editorial pipeline.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { APPROVAL_STAGE } from "@/lib/pipeline/pipeline";
import { resolveOwnerId } from "@/lib/owner";
import type { Database } from "@/types/supabase";

type Db = SupabaseClient<Database>;

export interface PendingApprovalItem {
  contentId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  qualityScore: number | null;
  status: string;
  waitingSince: string;
}

export async function listPendingApprovals(
  sb: Db,
  ownerIdInput?: string
): Promise<PendingApprovalItem[]> {
  const ownerId = resolveOwnerId(ownerIdInput);

  const { data: runs, error } = await sb
    .from("pipeline_runs")
    .select("content_item_id,started_at,status")
    .eq("stage", APPROVAL_STAGE)
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(50);

  if (error || !runs?.length) return [];

  const contentIds = runs.map((r) => r.content_item_id);

  const { data: items, error: itemsError } = await sb
    .from("content_items")
    .select("id,owner_id,title,slug,excerpt,quality_score,status")
    .in("id", contentIds)
    .eq("owner_id", ownerId);

  if (itemsError || !items?.length) return [];

  const itemById = new Map(items.map((i) => [i.id, i]));
  const pending: PendingApprovalItem[] = [];

  for (const run of runs) {
    const item = itemById.get(run.content_item_id);
    if (!item) continue;
    pending.push({
      contentId: item.id,
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt,
      qualityScore: item.quality_score,
      status: item.status,
      waitingSince: run.started_at ?? new Date().toISOString(),
    });
  }

  return pending;
}
