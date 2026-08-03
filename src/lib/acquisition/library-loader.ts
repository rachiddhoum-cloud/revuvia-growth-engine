/**
 * Content library loader — wires Content Library UI to Supabase.
 */

import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import type { ContentKind } from "@/types";

export interface LibraryItemModel {
  id: string;
  title: string;
  kind: ContentKind;
  status: string;
  tags: string[];
  updatedAt: string;
  version: number;
  excerpt?: string;
}

export async function loadContentLibrary(ownerId?: string): Promise<LibraryItemModel[]> {
  const owner = resolveOwnerId(ownerId);
  const sb = createServiceRoleClient();

  const { data, error } = await sb
    .from("content_items")
    .select("id, title, kind, status, tags, updated_at, version, excerpt")
    .eq("owner_id", owner)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[cas] library load failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    kind: row.kind as ContentKind,
    status: row.status,
    tags: row.tags ?? [],
    updatedAt: row.updated_at,
    version: row.version,
    excerpt: row.excerpt ?? undefined,
  }));
}
