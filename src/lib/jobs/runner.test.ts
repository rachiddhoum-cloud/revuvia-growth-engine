import { describe, expect, it, vi } from "vitest";

import {
  backoffMs,
  isRetryableError,
  runJob,
} from "@/lib/jobs/runner";
import type { JobDefinition } from "@/lib/jobs";
import { MemoryJobStore } from "@/lib/jobs/memory-store";

function makeJob(overrides: Partial<JobDefinition> = {}): JobDefinition {
  return {
    id: "job-1",
    ownerId: "owner-1",
    name: "weekly_report",
    schedule: "0 8 * * 1",
    enabled: true,
    handler: vi.fn(async () => ({ ok: true, data: { reportId: "r-1" } })),
    ...overrides,
  };
}

describe("backoffMs", () => {
  it("returns 0 for first attempt", () => {
    expect(backoffMs(1)).toBe(0);
  });

  it("doubles from base", () => {
    expect(backoffMs(2, 1000, 30000)).toBe(2000);
    expect(backoffMs(3, 1000, 30000)).toBe(4000);
  });

  it("caps at max backoff", () => {
    expect(backoffMs(10, 1000, 5000)).toBe(5000);
  });
});

describe("isRetryableError", () => {
  it("detects overload / rate limit / 5xx", () => {
    expect(isRetryableError(new Error("OpenAI is overloaded"))).toBe(true);
    expect(isRetryableError(new Error("rate limit exceeded"))).toBe(true);
    expect(isRetryableError(new Error("500 internal"))).toBe(true);
    expect(isRetryableError(new Error("timed out"))).toBe(true);
  });

  it("does not retry permanent errors", () => {
    expect(isRetryableError(new Error("Invalid JSON"))).toBe(false);
    expect(isRetryableError(new Error("Not found"))).toBe(false);
    expect(isRetryableError("not an error")).toBe(false);
  });
});

describe("runJob", () => {
  it("completes on first attempt and records a run", async () => {
    const job = makeJob();
    const store = new MemoryJobStore([job]);
    const outcome = await runJob(job, store);

    expect(outcome.status).toBe("completed");
    expect(outcome.attempts).toBe(1);
    expect(outcome.error).toBeNull();
    expect(store.getRuns()).toHaveLength(1);
    expect(store.getRuns()[0].status).toBe("completed");
    expect(store.getRegisteredJobs()[0].lastRunAt).toBeDefined();
  });

  it("retries on retryable errors then completes", async () => {
    const store = new MemoryJobStore();
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("OpenAI overloaded"))
      .mockResolvedValueOnce({ ok: true, data: { ok: 1 } });
    const outcome = await runJob(makeJob({ handler }), store, { baseBackoffMs: 1 });

    expect(outcome.status).toBe("completed");
    expect(outcome.attempts).toBe(2);
    expect(handler).toHaveBeenCalledTimes(2);
    expect(store.getRuns().map((r) => r.status)).toEqual(["retrying", "completed"]);
  });

  it("fails permanently after exhausting attempts", async () => {
    const store = new MemoryJobStore();
    const handler = vi.fn(async () => {
      throw new Error("overloaded");
    });
    const outcome = await runJob(makeJob({ handler }), store, { maxAttempts: 3, baseBackoffMs: 1 });

    expect(outcome.status).toBe("failed");
    expect(outcome.attempts).toBe(3);
    expect(outcome.error).toContain("overloaded");
    expect(handler).toHaveBeenCalledTimes(3);
    expect(store.getRuns().map((r) => r.status)).toEqual(["retrying", "retrying", "failed"]);
  });

  it("does not retry non-retryable errors", async () => {
    const store = new MemoryJobStore();
    const handler = vi.fn(async () => {
      throw new Error("Invalid input");
    });
    const outcome = await runJob(makeJob({ handler }), store, { maxAttempts: 3, baseBackoffMs: 1 });

    expect(outcome.status).toBe("failed");
    expect(outcome.attempts).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("passes attempt and lastError in context", async () => {
    const store = new MemoryJobStore();
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("OpenAI overloaded"))
      .mockResolvedValueOnce({ ok: true });
    await runJob(makeJob({ handler }), store, { baseBackoffMs: 1 });

    expect(handler.mock.calls[0][0].attempt).toBe(1);
    expect(handler.mock.calls[0][0].lastError).toBeNull();
    expect(handler.mock.calls[1][0].attempt).toBe(2);
    expect(handler.mock.calls[1][0].lastError).toBe("OpenAI overloaded");
  });

  it("skips disabled jobs", async () => {
    const store = new MemoryJobStore();
    const handler = vi.fn(async () => ({ ok: true }));
    const outcome = await runJob(makeJob({ enabled: false, handler }), store);

    expect(outcome.status).toBe("failed");
    expect(outcome.error).toContain("disabled");
    expect(handler).not.toHaveBeenCalled();
    expect(store.getRuns()).toHaveLength(0);
  });
});
