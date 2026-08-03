/**
 * In-memory PipelineStore for unit tests and local runs.
 * Mirrors the Supabase-backed store semantics (idempotency keys included).
 */

import type { PipelineContentItem, PipelineStore } from "@/lib/pipeline/pipeline";
import type { PipelineStage, PipelineStageResult } from "@/types";
import type { PipelineStageStatus } from "@/types/supabase";

interface RunRecord {
  stage: PipelineStage;
  status: PipelineStageStatus;
  attempt: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  payload?: Record<string, unknown>;
}

export class MemoryPipelineStore implements PipelineStore {
  private runs = new Map<string, RunRecord>();
  private items = new Map<string, PipelineContentItem>();
  private published: PipelineContentItem[] = [];

  constructor(seedItems: PipelineContentItem[] = []) {
    for (const item of seedItems) this.items.set(item.id, item);
  }

  private key(contentId: string, stage: PipelineStage): string {
    return `${contentId}:${stage}`;
  }

  async getStage(contentId: string, stage: PipelineStage): Promise<PipelineStageResult | null> {
    const rec = this.runs.get(this.key(contentId, stage));
    if (!rec) return null;
    return {
      stage: rec.stage,
      status: rec.status,
      attempt: rec.attempt,
      error: rec.error,
      startedAt: rec.startedAt,
      completedAt: rec.completedAt,
      payload: rec.payload,
    };
  }

  async startStage(contentId: string, stage: PipelineStage, attempt: number): Promise<void> {
    this.runs.set(this.key(contentId, stage), {
      stage,
      status: "running",
      attempt,
      startedAt: new Date().toISOString(),
    });
  }

  async passStage(contentId: string, stage: PipelineStage, attempt: number, payload?: Record<string, unknown>): Promise<void> {
    this.runs.set(this.key(contentId, stage), {
      stage,
      status: "passed",
      attempt,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      payload,
    });
  }

  async failStage(contentId: string, stage: PipelineStage, attempt: number, error: string): Promise<void> {
    this.runs.set(this.key(contentId, stage), {
      stage,
      status: "failed",
      attempt,
      error,
      startedAt: new Date().toISOString(),
    });
  }

  async skipStage(contentId: string, stage: PipelineStage): Promise<void> {
    this.runs.set(this.key(contentId, stage), {
      stage,
      status: "skipped",
      attempt: 0,
    });
  }

  async setContentStatus(contentId: string, status: string): Promise<void> {
    const item = this.items.get(contentId);
    if (item) item.status = status;
  }

  async saveContentItem(item: PipelineContentItem): Promise<void> {
    this.items.set(item.id, { ...item });
  }

  async getContentItem(contentId: string): Promise<PipelineContentItem | null> {
    return this.items.get(contentId) ?? null;
  }

  async findItemByKeyword(keyword: string, ownerId: string): Promise<PipelineContentItem | null> {
    for (const item of this.items.values()) {
      if (item.ownerId !== ownerId) continue;
      if (item.keyword === keyword) return item;
    }
    return null;
  }

  async listPublishedArticles(): Promise<Array<{ id: string; title: string; slug: string; tags?: string[]; excerpt?: string }>> {
    return this.published.map((i) => ({
      id: i.id,
      title: typeof i.title === "string" ? i.title : i.keyword,
      slug: typeof i.slug === "string" ? i.slug : i.keyword,
      tags: Array.isArray(i.tags) ? (i.tags as string[]) : undefined,
      excerpt: typeof i.excerpt === "string" ? i.excerpt : undefined,
    }));
  }

  async markPublished(contentId: string): Promise<void> {
    const item = this.items.get(contentId);
    if (item) {
      item.status = "published";
      this.published.push(item);
    }
  }
}
