import { describe, expect, it, vi } from "vitest";

import {
  APPROVAL_STAGE,
  PIPELINE_STAGES,
  approvePipeline,
  rejectPipeline,
  runPipeline,
} from "@/lib/pipeline";
import type { StageExecutors } from "@/lib/pipeline";
import { MemoryPipelineStore } from "@/lib/pipeline/memory-store";
import type { PipelineContentItem } from "@/lib/pipeline";

function fakeExecutors(overrides: Partial<StageExecutors> = {}): StageExecutors {
  return {
    createIdea: vi.fn(async () => ({ id: "content-1" })),
    keywordResearch: vi.fn(async () => ({ primary: "qr codes", secondary: ["google reviews"], intent: "commercial" })),
    seoBrief: vi.fn(async () => ({ briefId: "brief-1" })),
    writeArticle: vi.fn(async () => ({
      title: "Guide to QR codes",
      slug: "guide-to-qr-codes",
      bodyMarkdown: "# Guide\n\nContent here with qr codes. ".repeat(30),
      excerpt: "A guide",
      metaTitle: "Guide to QR codes for restaurants",
      metaDescription: "m".repeat(140),
      tags: ["seo", "qr"],
      primaryKeyword: "qr codes",
    })),
    scoreArticle: vi.fn(async () => ({
      overall: 92,
      passed: true,
      dimensions: {} as never,
      createdAt: new Date().toISOString(),
    })),
    approve: vi.fn(async () => undefined),
    enrichInternalLinks: vi.fn(async () => [
      { targetType: "pricing" as const, targetUrl: "/pricing", anchorText: "pricing", rationale: "x", score: 80 },
    ]),
    publish: vi.fn(async () => undefined),
    recordPerformance: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("runPipeline", () => {
  it("runs all 9 stages in order when auto-approve is enabled", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors();
    const result = await runPipeline(
      "qr codes",
      { store, executors, autoApprove: true },
      "owner-1"
    );

    expect(result.contentItemId).toBe("content-1");
    expect(result.stages.map((s) => s.stage)).toEqual(PIPELINE_STAGES);
    expect(result.stages.every((s) => s.status === "passed")).toBe(true);
    expect(result.currentStatus).toBe("published");
    expect(executors.createIdea).toHaveBeenCalledWith({ keyword: "qr codes", ownerId: "owner-1" });
    expect(executors.publish).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: rerun skips passed stages", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors();
    await runPipeline("qr codes", { store, executors, autoApprove: true }, "owner-1");
    await runPipeline("qr codes", { store, executors, autoApprove: true }, "owner-1");

    expect(executors.createIdea).toHaveBeenCalledTimes(1);
    expect(executors.writeArticle).toHaveBeenCalledTimes(1);
    expect(executors.publish).toHaveBeenCalledTimes(1);
  });

  it("pauses at approval stage when auto-approve is off", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors();
    const result = await runPipeline("qr codes", { store, executors, autoApprove: false });

    const stages = result.stages.map((s) => s.stage);
    expect(stages).toEqual(["idea", "keyword_research", "seo_brief", "writing", "quality", "approval"]);
    expect(result.stoppedAt).toBe("approval");
    const approval = result.stages.find((s) => s.stage === "approval");
    expect(approval?.status).toBe("pending");
    expect(executors.publish).not.toHaveBeenCalled();
  });

  it("respects stopAt option", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors();
    const result = await runPipeline(
      "qr codes",
      { store, executors, autoApprove: true, stopAt: "seo_brief" },
      "owner-1"
    );

    expect(result.stages.map((s) => s.stage)).toEqual(["idea", "keyword_research", "seo_brief"]);
    expect(executors.writeArticle).not.toHaveBeenCalled();
  });

  it("marks quality failed and returns to draft when score < 80", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors({
      scoreArticle: vi.fn(async () => ({
        overall: 55,
        passed: false,
        dimensions: {} as never,
        createdAt: new Date().toISOString(),
      })),
    });
    const result = await runPipeline("qr codes", { store, executors, autoApprove: true }, "owner-1");

    const quality = result.stages.find((s) => s.stage === "quality");
    expect(quality?.status).toBe("failed");
    expect(executors.publish).not.toHaveBeenCalled();
    const item = await store.getContentItem("content-1");
    expect(item?.status).toBe("draft");
  });

  it("stops and records failure when a stage executor throws", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors({
      writeArticle: vi.fn(async () => {
        throw new Error("OpenAI overloaded");
      }),
    });
    const result = await runPipeline("qr codes", { store, executors, autoApprove: true }, "owner-1");

    const writing = result.stages.find((s) => s.stage === "writing");
    expect(writing?.status).toBe("failed");
    expect(writing?.error).toContain("OpenAI overloaded");
    expect(result.stoppedAt).toBe("writing");
  });
});

describe("approvePipeline", () => {
  it("approves a paused pipeline and continues", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors();
    await runPipeline("qr codes", { store, executors, autoApprove: false }, "owner-1");

    const approval = await approvePipeline("content-1", { store, executors });
    expect(executors.approve).toHaveBeenCalled();
    expect(approval.currentStatus).toBe("ready");

    // Now continue the rest with auto-approve to publish
    const resumed = await runPipeline("qr codes", { store, executors, autoApprove: true }, "owner-1");
    expect(resumed.stages.some((s) => s.stage === "published" && s.status === "passed")).toBe(true);
  });

  it("throws when no pipeline is awaiting approval", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors();
    await expect(approvePipeline("nonexistent", { store, executors })).rejects.toThrow(/awaiting approval/);
  });
});

describe("rejectPipeline", () => {
  it("rejects a paused pipeline and returns to draft", async () => {
    const store = new MemoryPipelineStore();
    const executors = fakeExecutors();
    await runPipeline("qr codes", { store, executors, autoApprove: false }, "owner-1");

    await rejectPipeline("content-1", { store }, "Not good enough");
    const item = await store.getContentItem("content-1");
    expect(item?.status).toBe("draft");
    const approval = await store.getStage("content-1", APPROVAL_STAGE);
    expect(approval?.status).toBe("failed");
  });
});

describe("stopAt and gating", () => {
  it("exposes all pipeline stage names", () => {
    expect(PIPELINE_STAGES).toHaveLength(9);
    expect(PIPELINE_STAGES).toContain(APPROVAL_STAGE);
  });
});

describe("MemoryPipelineStore", () => {
  it("finds items by keyword and lists published", async () => {
    const item: PipelineContentItem = { id: "a", ownerId: "o", keyword: "kw", status: "published", title: "T", slug: "t" };
    const store = new MemoryPipelineStore([item]);
    await store.markPublished("a");

    expect(await store.findItemByKeyword("kw", "o")).toEqual(item);
    expect(await store.listPublishedArticles()).toHaveLength(1);
    expect(await store.getContentItem("missing")).toBeNull();
  });
});
