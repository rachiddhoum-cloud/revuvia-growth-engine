/**
 * Supabase-backed PipelineStore.
 *
 * Persists pipeline runs to `pipeline_runs` (unique content_item_id+stage),
 * content status to `content_items.status`, and publishes to `social_posts`.
 * Idempotency is preserved via the unique constraint + upsert semantics.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/supabase";
import type { PipelineContentItem, PipelineStore } from "@/lib/pipeline/pipeline";
import type { PipelineStage, PipelineStageResult } from "@/types";

type Db = SupabaseClient<Database>;

export class SupabasePipelineStore implements PipelineStore {
  constructor(
    private readonly sb: Db,
    private readonly defaultOwnerId = "system"
  ) {}

  async getStage(contentId: string, stage: PipelineStage): Promise<PipelineStageResult | null> {
    const { data, error } = await this.sb
      .from("pipeline_runs")
      .select("stage,status,attempt,error,payload,started_at,completed_at")
      .eq("content_item_id", contentId)
      .eq("stage", stage)
      .maybeSingle();
    if (error) throw new Error(`Failed to load stage: ${error.message}`);
    if (!data) return null;
    return {
      stage: data.stage as PipelineStage,
      status: data.status as PipelineStageResult["status"],
      attempt: data.attempt,
      error: data.error ?? undefined,
      startedAt: data.started_at ?? undefined,
      completedAt: data.completed_at ?? undefined,
      payload: data.payload as Record<string, unknown> | undefined,
    };
  }

  async startStage(contentId: string, stage: PipelineStage, attempt: number): Promise<void> {
    const { error } = await this.sb
      .from("pipeline_runs")
      .upsert(
        {
          content_item_id: contentId,
          stage,
          status: "running",
          attempt,
          started_at: new Date().toISOString(),
        },
        { onConflict: "content_item_id,stage" }
      );
    if (error) throw new Error(`Failed to start stage: ${error.message}`);
  }

  async passStage(
    contentId: string,
    stage: PipelineStage,
    attempt: number,
    payload?: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.sb
      .from("pipeline_runs")
      .upsert(
        {
          content_item_id: contentId,
          stage,
          status: "passed",
          attempt,
          payload: (payload ?? {}) as unknown as Json,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "content_item_id,stage" }
      );
    if (error) throw new Error(`Failed to pass stage: ${error.message}`);
  }

  async failStage(contentId: string, stage: PipelineStage, attempt: number, errorMsg: string): Promise<void> {
    const { error } = await this.sb
      .from("pipeline_runs")
      .upsert(
        {
          content_item_id: contentId,
          stage,
          status: "failed",
          attempt,
          error: errorMsg,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "content_item_id,stage" }
      );
    if (error) throw new Error(`Failed to fail stage: ${error.message}`);
  }

  async skipStage(contentId: string, stage: PipelineStage): Promise<void> {
    const { error } = await this.sb
      .from("pipeline_runs")
      .upsert(
        { content_item_id: contentId, stage, status: "skipped", attempt: 0 },
        { onConflict: "content_item_id,stage" }
      );
    if (error) throw new Error(`Failed to skip stage: ${error.message}`);
  }

  async setContentStatus(contentId: string, status: string): Promise<void> {
    const { error } = await this.sb
      .from("content_items")
      .update({ status: status as Database["public"]["Tables"]["content_items"]["Row"]["status"] })
      .eq("id", contentId);
    if (error) throw new Error(`Failed to set content status: ${error.message}`);
  }

  async saveContentItem(item: PipelineContentItem): Promise<void> {
    const { error } = await this.sb.from("content_items").upsert(
      {
        id: item.id,
        owner_id: item.ownerId ?? this.defaultOwnerId,
        title: item.title ?? item.keyword,
        slug: item.slug ?? item.keyword,
        status: (item.status ?? "idea") as Database["public"]["Tables"]["content_items"]["Row"]["status"],
        body_markdown: item.bodyMarkdown ?? null,
        excerpt: item.excerpt ?? null,
        meta_title: item.metaTitle ?? null,
        meta_description: item.metaDescription ?? null,
        tags: item.tags ?? [],
        json_ld: {},
        faqs: [],
        internal_links: [],
        cta: {},
      },
      { onConflict: "id" }
    );
    if (error) throw new Error(`Failed to save content item: ${error.message}`);
  }

  async getContentItem(contentId: string): Promise<PipelineContentItem | null> {
    const { data, error } = await this.sb
      .from("content_items")
      .select("id,owner_id,title,slug,status,body_markdown,excerpt,meta_title,meta_description,tags,keyword_id")
      .eq("id", contentId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load content item: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      ownerId: data.owner_id,
      keyword: data.title ?? data.id,
      status: data.status,
      title: data.title ?? undefined,
      slug: data.slug ?? undefined,
      bodyMarkdown: data.body_markdown ?? undefined,
      excerpt: data.excerpt ?? undefined,
      metaTitle: data.meta_title ?? undefined,
      metaDescription: data.meta_description ?? undefined,
      tags: data.tags ?? undefined,
    };
  }

  async findItemByKeyword(keyword: string, ownerId: string): Promise<PipelineContentItem | null> {
    const { data, error } = await this.sb
      .from("content_items")
      .select("id,owner_id,title,slug,status")
      .eq("owner_id", ownerId)
      .eq("title", keyword)
      .maybeSingle();
    if (error) throw new Error(`Failed to find content item: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      ownerId: data.owner_id,
      keyword: data.title ?? keyword,
      status: data.status,
      title: data.title ?? undefined,
      slug: data.slug ?? undefined,
    };
  }

  async listPublishedArticles(): Promise<
    Array<{ id: string; title: string; slug: string; tags?: string[]; excerpt?: string }>
  > {
    const { data, error } = await this.sb
      .from("content_items")
      .select("id,title,slug,tags,excerpt")
      .eq("status", "published")
      .limit(50);
    if (error) throw new Error(`Failed to list published articles: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      tags: row.tags ?? undefined,
      excerpt: row.excerpt ?? undefined,
    }));
  }
}
