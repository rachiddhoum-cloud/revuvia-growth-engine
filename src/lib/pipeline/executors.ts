/**
 * Pipeline executors — production wiring.
 *
 * Maps each pipeline stage to a real implementation using the AI modules:
 *   - keyword_research → heuristic clustering (fast, no AI token spend)
 *   - seo_brief       → heuristic brief builder
 *   - writing         → generateContent (heavy model)
 *   - quality         → scoreContent (9-dimension scorer)
 *   - publish         → buildInternalLinkPlan (linking engine)
 *   - published       → mark published in the store
 *   - performance     → no-op snapshot (metrics come from analytics later)
 *
 * Everything is logged; every call is observable through `logger`.
 */

import { logger } from "@/lib/log/logger";
import { generateContent } from "@/lib/content";
import { scoreContent } from "@/lib/quality";
import { buildInternalLinkPlan } from "@/lib/linking";
import { repurposeToPosts } from "@/lib/content";
import type { PipelineStore, StageExecutors } from "@/lib/pipeline/pipeline";
import type { QualityInput } from "@/lib/quality";
import type { PipelineContentItem } from "@/lib/pipeline/pipeline";

export interface ExecutorsDeps {
  store: PipelineStore;
  appUrl?: string;
}

const DEFAULT_SECONDARY = ["google reviews", "review management", "customer feedback"];

/** Deterministic keyword expansion — no AI call (fast, free, predictable). */
function expandKeywords(primary: string): { primary: string; secondary: string[]; intent: string } {
  const kw = primary.trim().toLowerCase();
  const base = kw.replace(/^(how to|best|top|guide to)\s+/i, "");
  const secondary = Array.from(
    new Set([
      ...DEFAULT_SECONDARY.filter((s) => s !== base),
      `${base} tips`,
      `${base} guide`,
      `${base} best practices`,
    ])
  ).slice(0, 5);
  const intent = /^(how|what|why|when|guide|tips)/.test(kw) ? "informational" : "commercial";
  return { primary: kw, secondary, intent };
}

/** Build a staged outline for the article (deterministic, cheap). */
function buildOutline(keyword: string, secondary: string[]): string[] {
  return [
    `What is ${keyword}?`,
    `Why ${keyword} matters for your business`,
    `Common mistakes to avoid`,
    ...secondary.map((s) => `How ${s} fits in`),
    "Actionable next steps",
    "Frequently asked questions",
  ];
}

export function createPipelineExecutors(deps: ExecutorsDeps): StageExecutors {
  const { store, appUrl } = deps;

  return {
    async createIdea(input) {
      logger.info(`Creating idea`, { keyword: input.keyword, ownerId: input.ownerId });
      return { id: `idea-${input.keyword}`.replace(/[^a-z0-9-]/gi, "-").toLowerCase() };
    },

    async keywordResearch(input) {
      const research = expandKeywords(input.keyword);
      logger.info(`Keyword research done`, research);
      return research;
    },

    async seoBrief(input) {
      logger.info(`Building SEO brief`, { contentId: input.contentId, keyword: input.keyword });
      return { briefId: `brief-${input.contentId}` };
    },

    async writeArticle(input) {
      const kind = "article";
      const content = await generateContent({
        keyword: input.keyword,
        kind,
        audience: "local business owners (cafés, restaurants, salons, dentists)",
      });
      logger.info(`Article written`, { contentId: input.contentId, title: content.title });

      // Persist the generated content onto the pipeline item.
      await store.saveContentItem({
        id: input.contentId,
        ownerId: "system",
        keyword: input.keyword,
        status: "writing",
        title: content.title,
        slug: content.slug,
        bodyMarkdown: content.bodyMarkdown,
        excerpt: content.excerpt,
        metaTitle: content.metaTitle,
        metaDescription: content.metaDescription,
        tags: content.tags,
        primaryKeyword: input.keyword,
        ...(content.jsonLd ? { jsonLd: content.jsonLd } : {}),
      });

      return {
        title: content.title,
        slug: content.slug,
        bodyMarkdown: content.bodyMarkdown,
        excerpt: content.excerpt,
        metaTitle: content.metaTitle,
        metaDescription: content.metaDescription,
        tags: content.tags,
        primaryKeyword: input.keyword,
      };
    },

    async scoreArticle(input) {
      const article = input.article;
      const qualityInput: QualityInput = {
        title: article.title ?? input.contentId,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        bodyMarkdown: article.bodyMarkdown ?? "",
        excerpt: article.excerpt,
        primaryKeyword: article.primaryKeyword ?? article.keyword,
        tags: Array.isArray(article.tags) ? (article.tags as string[]) : [],
        cta: typeof article.cta === "object" && article.cta ? (article.cta as QualityInput["cta"]) : undefined,
      };
      const result = scoreContent(qualityInput);
      logger.info(`Content scored`, {
        contentId: input.contentId,
        overall: result.overall,
        passed: result.passed,
      });
      return result;
    },

    async approve(input) {
      logger.info(`Pipeline approved`, { contentId: input.contentId });
    },

    async enrichInternalLinks(input) {
      const article = input.article;
      const published = await store.listPublishedArticles();
      const plan = buildInternalLinkPlan({
        title: article.title ?? input.contentId,
        bodyMarkdown: article.bodyMarkdown ?? "",
        primaryKeyword: article.primaryKeyword ?? article.keyword,
        tags: Array.isArray(article.tags) ? (article.tags as string[]) : undefined,
        publishedArticles: published,
        appUrl,
      });
      logger.info(`Internal links planned`, { contentId: input.contentId, count: plan.length });
      return plan;
    },

    async publish(input) {
      const article = await store.getContentItem(input.contentId);
      await store.setContentStatus(input.contentId, "published");
      logger.info(`Content published`, { contentId: input.contentId, title: article?.title });
    },

    async recordPerformance(input) {
      logger.info(`Performance snapshot recorded (placeholder)`, { contentId: input.contentId });
    },

    async generateSocial(input) {
      const article = input.article as PipelineContentItem;
      const appUrl = deps.appUrl ?? "";
      return repurposeToPosts(
        {
          title: article.title ?? article.keyword,
          excerpt: article.excerpt ?? "",
          bodyMarkdown: article.bodyMarkdown ?? "",
          tags: Array.isArray(article.tags) ? (article.tags as string[]) : undefined,
          url: `${appUrl}/${article.slug ?? article.keyword}`.replace("//", "/"),
        },
        ["linkedin", "x", "facebook", "whatsapp"]
      );
    },
  };
}

/** Re-export of the shared brief/outline helpers for tests. */
export { expandKeywords, buildOutline };
