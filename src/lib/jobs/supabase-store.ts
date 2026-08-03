/**
 * Supabase-backed JobStore.
 *
 * Persists job runs to `job_runs` (per attempt) and touches `jobs.last_run_at`
 * on completion. Runs are append-only rows — every attempt is observable.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import type { JobDefinition, JobStore } from "@/lib/jobs/types";

type Db = SupabaseClient<Database>;

export class SupabaseJobStore implements JobStore {
  constructor(private readonly sb: Db) {}

  async getJob(jobId: string): Promise<JobDefinition | null> {
    const { data, error } = await this.sb
      .from("jobs")
      .select("id,owner_id,name,schedule,enabled,last_run_at")
      .eq("id", jobId)
      .maybeSingle();
    if (error) throw new Error(`Failed to load job: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      ownerId: data.owner_id,
      name: data.name,
      schedule: data.schedule,
      enabled: data.enabled,
      lastRunAt: data.last_run_at,
      handler: async () => ({ ok: true }), // filled by the route that resolves real handlers
    };
  }

  async startRun(jobId: string, attempt: number): Promise<{ runId: string }> {
    const { data, error } = await this.sb
      .from("job_runs")
      .insert({
        job_id: jobId,
        status: "running",
        attempt,
        max_attempts: 3,
        result: {},
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to start job run: ${error.message}`);
    return { runId: data.id };
  }

  async completeRun(runId: string, result: Record<string, unknown>): Promise<void> {
    const { error } = await this.sb
      .from("job_runs")
      .update({
        status: "completed",
        result: result as unknown as Database["public"]["Tables"]["job_runs"]["Row"]["result"],
        finished_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", runId);
    if (error) throw new Error(`Failed to complete job run: ${error.message}`);
  }

  async failRun(runId: string, errorMsg: string): Promise<void> {
    const { error } = await this.sb
      .from("job_runs")
      .update({
        status: "failed",
        error: errorMsg,
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (error) throw new Error(`Failed to fail job run: ${error.message}`);
  }

  async retryRun(runId: string, errorMsg: string): Promise<void> {
    const { error } = await this.sb
      .from("job_runs")
      .update({ status: "retrying", error: errorMsg })
      .eq("id", runId);
    if (error) throw new Error(`Failed to mark job run retrying: ${error.message}`);
  }

  async touchJob(jobId: string, at: string): Promise<void> {
    const { error } = await this.sb
      .from("jobs")
      .update({ last_run_at: at })
      .eq("id", jobId);
    if (error) throw new Error(`Failed to touch job: ${error.message}`);
  }
}
