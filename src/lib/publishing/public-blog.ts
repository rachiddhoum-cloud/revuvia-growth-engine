import "server-only";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import { blogPostUrl } from "@/lib/publishing/site-config";
import type { PublicBlogArticle } from "@/lib/publishing/types";

type ContentRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body_markdown: string | null;
  meta_title: string | null;
  meta_description: string | null;
  tags: string[] | null;
  published_at: string | null;
  cover_url: string | null;
  kind: string;
  status: string;
};

function mapRow(row: ContentRow): PublicBlogArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    bodyMarkdown: row.body_markdown ?? "",
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    tags: row.tags ?? [],
    publishedAt: row.published_at,
    canonicalUrl: blogPostUrl(row.slug),
    coverUrl: row.cover_url,
  };
}

/** Published SEO articles for the public blog API and /blog pages. */
export async function loadPublicBlogArticles(ownerId?: string): Promise<PublicBlogArticle[]> {
  const sb = createServiceRoleClient();
  let query = sb
    .from("content_items")
    .select(
      "id,slug,title,excerpt,body_markdown,meta_title,meta_description,tags,published_at,cover_url,kind,status"
    )
    .eq("kind", "article")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false });

  // Feed public Revuvia : tous les articles publiés (évite mismatch DEFAULT_OWNER_ID).
  if (ownerId?.trim()) {
    query = query.eq("owner_id", resolveOwnerId(ownerId));
  }

  const { data, error } = await query;

  if (error) throw new Error(`Failed to load blog articles: ${error.message}`);
  return (data ?? []).map((row) => mapRow(row as ContentRow));
}

export async function loadPublicBlogArticleBySlug(
  slug: string,
  ownerId?: string
): Promise<PublicBlogArticle | null> {
  const sb = createServiceRoleClient();
  let query = sb
    .from("content_items")
    .select(
      "id,slug,title,excerpt,body_markdown,meta_title,meta_description,tags,published_at,cover_url,kind,status"
    )
    .eq("kind", "article")
    .eq("status", "published")
    .eq("slug", slug.trim());

  if (ownerId?.trim()) {
    query = query.eq("owner_id", resolveOwnerId(ownerId));
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(`Failed to load blog article: ${error.message}`);
  if (!data) return null;
  return mapRow(data as ContentRow);
}
