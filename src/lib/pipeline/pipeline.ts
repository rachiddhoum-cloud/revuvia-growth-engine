/**
 * Editorial Pipeline — Phase 1.
 * Drives a content item through 9 persisted stages:
 *   idea → keyword_research → seo_brief → writing → quality
 *   → approval → publish → published → performance
 *
 * Every stage is persisted to `pipeline_runs` with a unique (content_item_id, stage)
 * key → idempotent: rerunning a passed stage is a no-op. Stage executors are injected
 * so the core is pure and unit-testable without Supabase or AI calls.
 */

import type {
  ContentQualityResult,
  ContentStatus,
  InternalLinkSuggestion,
  PipelineRunResult,
  PipelineStage,
  PipelineStageResult,
  SocialPostOutput,
} from "@/types";
import { logger } from "@/lib/log/logger";

export const PIPELINE_STAGES: PipelineStage[] = [
  "idea",
  "keyword_research",
  "seo_brief",
  "writing",
  "quality",
  "approval",
  "publish",
  "published",
  "performance",
];

/** Human-gated stage: pipeline pauses here and needs explicit approval. */
export const APPROVAL_STAGE: PipelineStage = "approval";

export const QUALITY_PASS_THRESHOLD = 80;

export interface PipelineContentItem {
  id: string;
  ownerId: string;
  keyword: string;
  status: string;
  title?: string;
  slug?: string;
  bodyMarkdown?: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  tags?: string[];
  primaryKeyword?: string;
  [key: string]: unknown;
}

export interface StageExecutors {
  /** Creates the content item row (idea stage). Returns its id. */
  createIdea(input: { keyword: string; ownerId: string; kind?: string }): Promise<{ id: string }>;
  /** Keyword research → returns primary + secondary keywords + intent. */
  keywordResearch(input: { keyword: string }): Promise<{ primary: string; secondary: string[]; intent: string }>;
  /** Builds the SEO brief. */
  seoBrief(input: { contentId: string; keyword: string; secondary: string[]; intent: string }): Promise<{ briefId: string }>;
  /** Generates the long article and persists it. */
  writeArticle(input: { contentId: string; briefId: string; keyword: string; secondary: string[] }): Promise<{
    title: string;
    slug: string;
    bodyMarkdown: string;
    excerpt: string;
    metaTitle: string;
    metaDescription: string;
    tags: string[];
    primaryKeyword: string;
  }>;
  /** Scores the generated article. */
  scoreArticle(input: { contentId: string; article: PipelineContentItem }): Promise<ContentQualityResult>;
  /** Approves (human step; when auto-approve is set, marks passed). */
  approve(input: { contentId: string }): Promise<void>;
  /** Enriches with internal links before publish. */
  enrichInternalLinks(input: { contentId: string; article: PipelineContentItem }): Promise<InternalLinkSuggestion[]>;
  /** Publishes the item. */
  publish(input: { contentId: string }): Promise<void>;
  /** Records performance snapshot after publish. */
  recordPerformance(input: { contentId: string }): Promise<void>;
  /** Optional: generate social posts after publish. */
  generateSocial?(input: { contentId: string; article: PipelineContentItem }): Promise<SocialPostOutput[]>;
}

export interface PipelineStore {
  /** Get the current stage run record (for idempotency). */
  getStage(contentId: string, stage: PipelineStage): Promise<PipelineStageResult | null>;
  /** Create a stage run as running. */
  startStage(contentId: string, stage: PipelineStage, attempt: number): Promise<void>;
  /** Mark a stage as passed with optional payload. */
  passStage(contentId: string, stage: PipelineStage, attempt: number, payload?: Record<string, unknown>): Promise<void>;
  /** Mark a stage as failed (allows retry). */
  failStage(contentId: string, stage: PipelineStage, attempt: number, error: string): Promise<void>;
  /** Mark a stage as skipped. */
  skipStage(contentId: string, stage: PipelineStage): Promise<void>;
  /** Update the content item's status (moves it through the workflow). */
  setContentStatus(contentId: string, status: string): Promise<void>;
  /** Persist a newly created content item (idea stage). */
  saveContentItem(item: PipelineContentItem): Promise<void>;
  /** Load the full content item. */
  getContentItem(contentId: string): Promise<PipelineContentItem | null>;
  /** Find an existing content item by its primary keyword (for idempotent reruns). */
  findItemByKeyword(keyword: string, ownerId: string): Promise<PipelineContentItem | null>;
  /** Load related published articles (for internal linking). */
  listPublishedArticles(): Promise<Array<{ id: string; title: string; slug: string; tags?: string[]; excerpt?: string }>>;
}

export interface PipelineOptions {
  store: PipelineStore;
  executors: StageExecutors;
  /** Auto-approve quality stage without human gate (default false). */
  autoApprove?: boolean;
  /** Stop after this stage (e.g. "quality" for human review). */
  stopAt?: PipelineStage;
}

const toIso = (d?: string): string | undefined => (d ? new Date(d).toISOString() : undefined);/** Run the pipeline for a content item. Idempotent per stage. */
export async function runPipeline(
  keyword: string,
  options: PipelineOptions,
  ownerId = "system"
): Promise<PipelineRunResult> {
  const { store, executors } = options;
  const results: PipelineStageResult[] = [];
  const stopAt = options.stopAt ?? "performance";

  // ── Stage 1: idea (idempotent by keyword) ─────────────────────
  let contentId: string | null = null;
  const existingItem = await store.findItemByKeyword(keyword, ownerId);

  if (existingItem) {
    contentId = existingItem.id;
    const existingIdea = await store.getStage(contentId, "idea");
    if (existingIdea && existingIdea.status === "passed") {
      results.push(existingIdea);
    } else {
      await store.startStage(contentId, "idea", 1);
      await store.passStage(contentId, "idea", 1, { keyword });
      results.push({ stage: "idea", status: "passed", attempt: 1, completedAt: new Date().toISOString() });
    }
  } else {
    try {
      const created = await executors.createIdea({ keyword, ownerId });
      contentId = created.id;
      await store.saveContentItem({
        id: contentId,
        ownerId,
        keyword,
        status: "idea",
        primaryKeyword: keyword,
      });
      await store.startStage(contentId, "idea", 1);
      await store.passStage(contentId, "idea", 1, { keyword });
      results.push({ stage: "idea", status: "passed", attempt: 1, completedAt: new Date().toISOString() });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Pipeline failed at stage "idea": ${message}`);
    }
  }

  // ── Remaining stages ──────────────────────────────────────────
  for (const stage of PIPELINE_STAGES.slice(1)) {
    if (stageIndex(stage) > stageIndex(stopAt)) break;

    const existing = await store.getStage(contentId!, stage);
    if (existing && existing.status === "passed") {
      results.push(existing);
      continue;
    }

    if (stage === APPROVAL_STAGE && !options.autoApprove) {
      await store.startStage(contentId!, stage, 1);
      results.push({ stage, status: "pending", attempt: 1, startedAt: new Date().toISOString() });
      // Pause pipeline: wait for human approval.
      break;
    }

    const attempt = (existing?.attempt ?? 0) + 1;
    await store.startStage(contentId!, stage, attempt);
    try {
      const outcome = await runStage(stage, contentId!, store, executors);
      if (outcome.status === "passed") {
        await store.passStage(contentId!, stage, attempt, outcome.payload);
        results.push({
          stage,
          status: "passed",
          attempt,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          payload: outcome.payload,
        });
      } else {
        // Quality gate failed → back to draft, stop the pipeline.
        await store.failStage(contentId!, stage, attempt, outcome.error ?? "Quality gate failed");
        await store.setContentStatus(contentId!, "draft");
        results.push({
          stage,
          status: "failed",
          attempt,
          error: outcome.error ?? "Quality gate failed",
          startedAt: new Date().toISOString(),
        });
        break;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await store.failStage(contentId!, stage, attempt, message);
      logger.error(`Pipeline stage failed`, { stage, contentId, attempt }, err);
      results.push({ stage, status: "failed", attempt, error: message, startedAt: new Date().toISOString() });
      break;
    }
  }

  const item = await store.getContentItem(contentId!);
  return {
    contentItemId: contentId!,
    stages: results,
    currentStatus: (item?.status as ContentStatus | undefined) ?? "idea",
    stoppedAt: lastStage(results),
  };
}

/** Rejects a paused pipeline and returns the item to draft. */
export async function rejectPipeline(
  contentId: string,
  options: Pick<PipelineOptions, "store">,
  reason = "Rejected by reviewer"
): Promise<void> {
  const { store } = options;
  const approval = await store.getStage(contentId, APPROVAL_STAGE);
  if (!approval || approval.status !== "running") {
    throw new Error("No pipeline is awaiting approval for this item");
  }
  await store.failStage(contentId, APPROVAL_STAGE, approval.attempt + 1, reason);
  await store.setContentStatus(contentId, "draft");
}

/** Explicit human approval → advances a paused pipeline. */
export async function approvePipeline(contentId: string, options: PipelineOptions): Promise<PipelineRunResult> {
  const { store } = options;
  const approval = await store.getStage(contentId, APPROVAL_STAGE);
  if (!approval) throw new Error("No pipeline is awaiting approval for this item");

  await store.startStage(contentId, APPROVAL_STAGE, approval.attempt + 1);
  await options.executors.approve({ contentId });
  await store.passStage(contentId, APPROVAL_STAGE, approval.attempt + 1, { approvedAt: new Date().toISOString() });
  await store.setContentStatus(contentId, "ready");

  const item = await store.getContentItem(contentId);
  const stages = [
    ...(await Promise.all(PIPELINE_STAGES.map((s) => store.getStage(contentId, s)))),
  ].filter((s): s is PipelineStageResult => s !== null);

  return {
    contentItemId: contentId,
    stages,
    currentStatus: (item?.status as ContentStatus | undefined) ?? "ready",
    stoppedAt: lastStage(stages),
  };
}

async function runStage(
  stage: PipelineStage,
  contentId: string,
  store: PipelineStore,
  executors: StageExecutors
): Promise<{ status: "passed" | "failed"; payload?: Record<string, unknown>; error?: string }> {
  switch (stage) {
    case "keyword_research": {
      const item = await mustGet(store, contentId);
      const kw = String(item.keyword);
      const research = await executors.keywordResearch({ keyword: kw });
      await store.setContentStatus(contentId, "keyword_research");
      return { status: "passed", payload: { ...research } };
    }
    case "seo_brief": {
      const item = await mustGet(store, contentId);
      const research = item as PipelineContentItem & { intent?: string; secondary?: string[] };
      const { briefId } = await executors.seoBrief({
        contentId,
        keyword: String(item.keyword),
        secondary: Array.isArray(research.secondary) ? research.secondary : [],
        intent: typeof research.intent === "string" ? research.intent : "informational",
      });
      await store.setContentStatus(contentId, "seo_brief");
      return { status: "passed", payload: { briefId } };
    }
    case "writing": {
      const item = await mustGet(store, contentId);
      const briefId = item.brief_id != null ? String(item.brief_id) : "";
      const article = await executors.writeArticle({
        contentId,
        briefId,
        keyword: String(item.keyword),
        secondary: Array.isArray(item.secondary) ? (item.secondary as string[]) : [],
      });
      await store.setContentStatus(contentId, "writing");
      return { status: "passed", payload: { ...article } };
    }
    case "quality": {
      const item = await mustGet(store, contentId);
      const result = await executors.scoreArticle({ contentId, article: item });
      await store.setContentStatus(contentId, "quality");
      if (!result.passed) {
        return {
          status: "failed",
          error: `Quality score ${result.overall} < ${QUALITY_PASS_THRESHOLD}`,
          payload: { overall: result.overall, passed: result.passed },
        };
      }
      return { status: "passed", payload: { overall: result.overall, passed: result.passed } };
    }
    case "approval": {
      await executors.approve({ contentId });
      await store.setContentStatus(contentId, "ready");
      return { status: "passed", payload: { approved: true } };
    }
    case "publish": {
      const item = await mustGet(store, contentId);
      const links = await executors.enrichInternalLinks({ contentId, article: item });
      return { status: "passed", payload: { internalLinks: links.length } };
    }
    case "published": {
      await executors.publish({ contentId });
      await store.setContentStatus(contentId, "published");
      return { status: "passed", payload: { publishedAt: new Date().toISOString() } };
    }
    case "performance": {
      await executors.recordPerformance({ contentId });
      return { status: "passed", payload: { recordedAt: new Date().toISOString() } };
    }
    default:
      return { status: "passed" };
  }
}

async function mustGet(store: PipelineStore, contentId: string): Promise<PipelineContentItem> {
  const item = await store.getContentItem(contentId);
  if (!item) throw new Error(`Content item ${contentId} not found`);
  return item;
}

function stageIndex(stage: PipelineStage): number {
  return PIPELINE_STAGES.indexOf(stage);
}

function lastStage(results: PipelineStageResult[]): PipelineStage {
  if (results.length === 0) return "idea";
  const last = results[results.length - 1];
  return (last.stage as PipelineStage) ?? "idea";
}

export { toIso };
