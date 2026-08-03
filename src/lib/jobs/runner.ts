/**
 * Background Job Runner — Phase 7.
 *
 * Executes a job handler with configurable retries and exponential backoff.
 * Persistence goes through an injected `JobStore`, keeping the core pure and
 * unit-testable without Supabase. Every run is recorded (`job_runs`) and the
 * job's `last_run_at` is touched on completion.
 */

import { logger } from "@/lib/log/logger";
import { sleep } from "@/lib/utils";
import type { JobContext, JobDefinition, JobStore } from "@/lib/jobs/types";

export interface JobRunnerOptions {
  /** @default 3 */
  maxAttempts?: number;
  /** Base backoff in ms (doubles each attempt). @default 1000 */
  baseBackoffMs?: number;
  /** Max backoff cap in ms. @default 30000 */
  maxBackoffMs?: number;
}

export interface JobRunOutcome {
  jobId: string;
  status: "completed" | "failed";
  attempts: number;
  error: string | null;
  result: Record<string, unknown>;
}

export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BASE_BACKOFF_MS = 1000;
export const DEFAULT_MAX_BACKOFF_MS = 30000;

/** Exponential backoff for a given 1-based attempt. */
export function backoffMs(
  attempt: number,
  base: number = DEFAULT_BASE_BACKOFF_MS,
  max: number = DEFAULT_MAX_BACKOFF_MS
): number {
  if (attempt <= 1) return 0;
  const exponent = Math.min(attempt - 1, 30);
  return Math.min(base * 2 ** exponent, max);
}

export function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    /overloaded|rate.?limit|timeout|timed out|429|5\d\d|too many|temporar/.test(message) ||
    err.name === "TimeoutError"
  );
}

/** Execute a job with retries. Returns a completed outcome or throws a final JobFailedError. */
export async function runJob(
  job: JobDefinition,
  store: JobStore,
  options: JobRunnerOptions = {}
): Promise<JobRunOutcome> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseBackoff = options.baseBackoffMs ?? DEFAULT_BASE_BACKOFF_MS;
  const maxBackoff = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;

  if (!job.enabled) {
    logger.info(`Job skipped (disabled)`, { jobId: job.id, name: job.name });
    return { jobId: job.id, status: "failed", attempts: 0, error: "Job is disabled", result: {} };
  }

  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const { runId } = await store.startRun(job.id, attempt);

    const context: JobContext = {
      jobId: job.id,
      attempt,
      lastError,
      runId,
    };

    try {
      const result = await job.handler(context);
      const payload = result.data ?? {};
      await store.completeRun(runId, {
        ...payload,
        ok: true,
        message: result.message,
        finishedAt: new Date().toISOString(),
      });
      await store.touchJob(job.id, new Date().toISOString());
      logger.info(`Job completed`, { jobId: job.id, name: job.name, attempt });
      return { jobId: job.id, status: "completed", attempts: attempt, error: null, result: payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      lastError = message;

      const shouldRetry = attempt < maxAttempts && isRetryableError(err);
      if (shouldRetry) {
        await store.retryRun(runId, message);
        const delay = backoffMs(attempt + 1, baseBackoff, maxBackoff);
        logger.warn(`Job attempt failed, retrying`, { jobId: job.id, name: job.name, attempt, delay }, err);
        if (delay > 0) await sleep(delay);
        continue;
      }

      await store.failRun(runId, message);
      logger.error(`Job failed after retries`, { jobId: job.id, name: job.name, attempt, maxAttempts }, err);
      return { jobId: job.id, status: "failed", attempts: attempt, error: message, result: {} };
    }
  }

  // Unreachable, but keeps the type honest.
  throw new Error(`Job ${job.id} exhausted attempts`);
}
