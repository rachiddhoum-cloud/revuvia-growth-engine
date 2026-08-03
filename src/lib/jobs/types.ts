import type { JobStatus } from "@/types";

/** A scheduled job definition (mirrors `jobs` row + handler). */
export interface JobDefinition {
  id: string;
  ownerId: string;
  name: string;
  schedule: string;
  enabled: boolean;
  lastRunAt?: string | null;
  handler: (ctx: JobContext) => Promise<JobResult>;
}

/** A single execution attempt of a job (mirrors `job_runs` row). */
export interface JobRun {
  id: string;
  jobId: string;
  status: JobStatus;
  attempt: number;
  maxAttempts: number;
  result: Record<string, unknown>;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** Context passed to a job handler. */
export interface JobContext {
  jobId: string;
  attempt: number;
  /** Previous attempt's error message, if any (retry). */
  lastError: string | null;
  runId: string;
}

export interface JobResult {
  ok: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

/** Injectable persistence boundary — mirrors the Supabase-backed store. */
export interface JobStore {
  /** Load a job by id (throws if missing). */
  getJob(jobId: string): Promise<JobDefinition | null>;
  /** Create a run row as running. */
  startRun(jobId: string, attempt: number): Promise<{ runId: string }>;
  /** Complete a run with result. */
  completeRun(runId: string, result: Record<string, unknown>): Promise<void>;
  /** Mark a run failed. */
  failRun(runId: string, error: string): Promise<void>;
  /** Mark a run retrying (between attempts). */
  retryRun(runId: string, error: string): Promise<void>;
  /** Record the last execution time on the job. */
  touchJob(jobId: string, at: string): Promise<void>;
}
