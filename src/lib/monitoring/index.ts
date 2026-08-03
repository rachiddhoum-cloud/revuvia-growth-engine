/**
 * Telemetry / monitoring hooks.
 * Persists AI generation runs to `generation_runs` (fire-and-forget, never
 * blocks the caller) and exposes structured error/event tracking.
 */

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/log/logger";

export interface AiRunRecord {
  module: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  status?: string;
  latencyMs?: number;
  ownerId?: string;
}

/**
 * Record an AI generation run. Uses the service-role client so it bypasses RLS
 * but is safe: failures are logged and never thrown to the caller.
 */
export async function recordAiRun(run: AiRunRecord): Promise<void> {
  try {
    const sb = createServiceRoleClient();
    await sb.from("generation_runs").insert({
      owner_id: run.ownerId ?? null,
      module: run.module,
      model: run.model,
      prompt_tokens: run.promptTokens,
      completion_tokens: run.completionTokens,
      cost_usd: run.costUsd,
      status: run.status ?? "completed",
    });
  } catch (err) {
    logger.warn("Failed to record AI run", { module: run.module, model: run.model }, err);
  }
}

export function trackError(scope: string, err: unknown, context: Record<string, unknown> = {}): void {
  logger.error(`[${scope}]`, context, err);
}

export function trackEvent(name: string, context: Record<string, unknown> = {}): void {
  logger.info(`event:${name}`, context);
}
