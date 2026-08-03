/**
 * In-memory JobStore for unit tests and local runs.
 * Mirrors the Supabase-backed store semantics.
 */

import type { JobDefinition, JobRun, JobStore } from "@/lib/jobs/types";

export class MemoryJobStore implements JobStore {
  private jobs = new Map<string, JobDefinition>();
  private runs = new Map<string, JobRun>();

  constructor(jobs: JobDefinition[] = []) {
    for (const job of jobs) this.jobs.set(job.id, job);
  }

  getRegisteredJobs(): JobDefinition[] {
    return [...this.jobs.values()];
  }

  getRuns(): JobRun[] {
    return [...this.runs.values()];
  }

  async getJob(jobId: string): Promise<JobDefinition | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async startRun(jobId: string, attempt: number): Promise<{ runId: string }> {
    const runId = `${jobId}:run-${attempt}`;
    this.runs.set(runId, {
      id: runId,
      jobId,
      status: "running",
      attempt,
      maxAttempts: 3,
      result: {},
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    });
    return { runId };
  }

  async completeRun(runId: string, result: Record<string, unknown>): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = "completed";
      run.result = result;
      run.finishedAt = new Date().toISOString();
      run.error = null;
    }
  }

  async failRun(runId: string, error: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = "failed";
      run.error = error;
      run.finishedAt = new Date().toISOString();
    }
  }

  async retryRun(runId: string, error: string): Promise<void> {
    const run = this.runs.get(runId);
    if (run) {
      run.status = "retrying";
      run.error = error;
    }
  }

  async touchJob(jobId: string, at: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (job) {
      this.jobs.set(jobId, { ...job, lastRunAt: at });
    }
  }
}
