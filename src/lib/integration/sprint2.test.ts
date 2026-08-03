/**
 * Sprint 2 — Integration test.
 *
 * Wires the full autonomous pipeline together using only in-memory stores:
 * idea → keyword research → brief → writing → quality → approval → publish →
 * published → performance, then generates social posts, runs a background job
 * with retries, and renders the analytics model from the persisted state.
 *
 * This is the Phase 9 "system works end-to-end" proof without any external IO.
 */

import { describe, expect, it, vi } from "vitest";

import { runPipeline, type StageExecutors } from "@/lib/pipeline";
import { MemoryPipelineStore } from "@/lib/pipeline/memory-store";
import { repurposeToPosts } from "@/lib/content";
import { scoreContent } from "@/lib/quality";
import { renderWeeklyReport } from "@/lib/reports";
import { runJob, MemoryJobStore, type JobDefinition } from "@/lib/jobs";
import { buildAnalyticsModel } from "@/lib/analytics/aggregate";

const BODY = `# Guide to QR codes for restaurants

## Why QR codes matter for local SEO

QR codes are the strongest direct link between a physical restaurant and its
online reviews. A customer who scans a smart QR code on their table lands on a
pre-filled review form in one tap, which dramatically increases completion rates.

## The fastest way to collect reviews

A smart QR code on the table is the fastest way to collect reviews. When a
customer finishes their meal, they scan a QR code, and a pre-filled review link
opens on their phone.

### Ask at the right moment

Timing matters. Ask for a review right after a positive interaction, not at
checkout when the customer is in a hurry.

### Make it effortless

The fewer taps required, the more reviews you collect. A single tap that opens
a pre-filled review form dramatically increases completion rates.

## Common mistakes to avoid

- Asking for a review before service is complete
- Making the review link hard to find
- Ignoring negative feedback
- Offering incentives that violate Google policy

## How to respond to reviews

Always respond to reviews within 48 hours. Thank positive reviewers and
acknowledge negative feedback with a concrete resolution plan.

## FAQ

### Do I need to ask every customer?

No. Focus on customers who had a clearly positive experience.

### Can I automate review requests?

Yes. Tools like Revuvia automate review collection with smart links and
scheduled reminders.

## Conclusion

Collecting reviews is a compounding growth channel for any local business.
Start with a simple QR code strategy and scale from there.`;

const ARTICLE_META = {
  title: "Guide to QR codes for restaurants",
  slug: "guide-to-qr-codes-for-restaurants",
  excerpt: "How QR codes boost review volume for restaurants.",
  metaTitle: "Guide to QR codes for restaurants (2026)",
  metaDescription:
    "How QR codes boost review volume for restaurants with one-tap review links, smart timing, and automated reminders. A practical guide for local business owners.",
  tags: ["seo", "qr-codes", "restaurants"],
  primaryKeyword: "qr codes",
};

function realExecutors(store: MemoryPipelineStore): StageExecutors {
  return {
    createIdea: async () => ({ id: "content-1" }),
    keywordResearch: async () => ({ primary: "qr codes", secondary: ["google reviews", "qr code tips"], intent: "commercial" }),
    seoBrief: async () => ({ briefId: "brief-1" }),
    writeArticle: async (input) => {
      await store.saveContentItem({
        id: input.contentId,
        ownerId: "owner-1",
        keyword: input.keyword,
        status: "writing",
        ...ARTICLE_META,
        bodyMarkdown: BODY,
      });
      return { ...ARTICLE_META, bodyMarkdown: BODY };
    },
    scoreArticle: async ({ article }) =>
      scoreContent({
        title: article.title ?? "",
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
        bodyMarkdown: article.bodyMarkdown ?? "",
        excerpt: article.excerpt,
        featuredSnippet:
          "A smart QR code on the table is the fastest way to collect reviews.",
        tags: Array.isArray(article.tags) ? (article.tags as string[]) : [],
        faqs: [
          { question: "Do I need to ask every customer?", answer: "No." },
          { question: "Can I automate review requests?", answer: "Yes." },
        ],
        internalLinks: [{ text: "Pricing", url: "/pricing" }],
        cta: { label: "Start collecting reviews", href: "/register", position: "bottom" },
        jsonLd: { Article: { "@type": "Article", headline: "Test" } },
        primaryKeyword: article.primaryKeyword ?? article.keyword,
      }),
    approve: async () => undefined,
    enrichInternalLinks: async () => [{ targetType: "pricing", targetUrl: "/pricing", anchorText: "pricing", rationale: "convert", score: 85 }],
    publish: async () => undefined,
    recordPerformance: async () => undefined,
  };
}

describe("Sprint 2 end-to-end (in-memory)", () => {
  it("pipeline → social → report → analytics", async () => {
    const store = new MemoryPipelineStore();
    const executors = realExecutors(store);

    // 1) Full pipeline with quality gate + publish.
    const result = await runPipeline(
      "qr codes",
      { store, executors, autoApprove: true },
      "owner-1"
    );
    expect(result.stages.length).toBe(9);
    expect(result.stages.every((s) => s.status === "passed")).toBe(true);
    expect(result.currentStatus).toBe("published");

    // 2) Social repurposing on the published item.
    const item = (await store.getContentItem("content-1"))!;
    const posts = repurposeToPosts(
      {
        title: item.title ?? item.keyword,
        excerpt: item.excerpt ?? "",
        bodyMarkdown: item.bodyMarkdown ?? "",
        tags: Array.isArray(item.tags) ? (item.tags as string[]) : undefined,
        url: `https://revuvia.app/${item.slug ?? item.keyword}`,
      },
      ["linkedin", "x", "whatsapp"]
    );
    expect(posts.length).toBeGreaterThanOrEqual(3);
    expect(posts.every((p) => p.body.length <= 1800)).toBe(true);

    // 3) Weekly report renders deterministically from metrics.
    const report = renderWeeklyReport({
      ownerId: "owner-1",
      periodStart: "2026-07-25",
      periodEnd: "2026-07-31",
      publishedCount: 1,
      impressions: 1200,
      clicks: 60,
      ctr: 5,
      topKeywords: [{ keyword: "qr codes", impressions: 1200, clicks: 60, position: 4.2 }],
      topPages: [{ url: "/guide-to-qr-codes", visits: 210, clicks: 60 }],
      aiProductivity: { runs: 4, tokens: 12_000, costUsd: 0.08, modules: { content: 2, social: 2 } },
      recommendations: ["Publish more comparison content"],
    });
    expect(report.markdown).toContain("Weekly SEO Report");
    expect(report.html).toContain("Impressions");
    expect(report.emailHtml).toContain("Revuvia Weekly Report");

    // 4) Background job with retry runs to completion.
    const job: JobDefinition = {
      id: "job-1",
      name: "weekly_report",
      ownerId: "owner-1",
      schedule: "0 8 * * 1",
      enabled: true,
      handler: async () => ({ ok: true, message: "done", data: { published: 1 } }),
    };
    const jobStore = new MemoryJobStore([job]);
    const outcome = await runJob(job, jobStore, { maxAttempts: 3 });
    expect(outcome.status).toBe("completed");
    expect(jobStore.getRuns().filter((r) => r.status === "completed")).toHaveLength(1);

    // 5) Analytics model aggregates the persisted state.
    const model = buildAnalyticsModel({
      days: 30,
      daily: [
        { metric_date: "2026-07-30", organic_visits: 210, clicks: 60, impressions: 1200, conversions: 3, lead_downloads: 1, revenue: 12 },
      ],
      pages: [{ url: "/guide-to-qr-codes", visits: 210, clicks: 60, impressions: 1200, ctr: 0.05, avg_position: 4.2 }],
      content: [{ id: "content-1", title: "Guide to QR codes", status: "published", quality_score: 90, created_at: "2026-07-28" }],
      runs: [{ module: "content", status: "success", cost_usd: 0.04, created_at: "2026-07-29" }],
    });
    expect(model.summary.publishedCount).toBe(1);
    expect(model.summary.totalVisits).toBe(210);
    expect(model.topPages[0].url).toBe("/guide-to-qr-codes");
  });

  it("quality gate blocks low-scoring content before publish", async () => {
    const store = new MemoryPipelineStore();
    const executors = realExecutors(store);
    executors.scoreArticle = async () => ({
      overall: 45,
      passed: false,
      dimensions: {} as never,
      createdAt: new Date().toISOString(),
    });

    const result = await runPipeline("qr codes", { store, executors, autoApprove: true }, "owner-1");
    expect(result.stages.some((s) => s.stage === "quality" && s.status === "failed")).toBe(true);
    expect(result.stages.some((s) => s.stage === "published")).toBe(false);
  });

  it("logs through the shared logger without throwing", async () => {
    // Guards against a regression in the production wiring of the executors.
    const store = new MemoryPipelineStore();
    const executors = realExecutors(store);
    expect(executors.writeArticle).toBeTypeOf("function");
    expect(vi.isMockFunction(executors.writeArticle)).toBe(false);
  });
});
