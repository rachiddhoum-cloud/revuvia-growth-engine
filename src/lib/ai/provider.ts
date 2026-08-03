import type { AiModelConfig } from "@/lib/ai/config";
import { completeOpenAI } from "@/lib/ai/openai";
import { completeAnthropic } from "@/lib/ai/anthropic";
import { withRetry, withTimeout } from "@/lib/reliability";
import { recordAiRun } from "@/lib/monitoring";

export interface AiCompleteOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  /** Optional explicit provider override. */
  provider?: "openai" | "anthropic";
  /** Module name for run tracking (e.g. "content", "seo", "social", "leadmagnet"). */
  module?: string;
  /** Owner id for run tracking (optional; anonymous runs are recorded too). */
  ownerId?: string;
}

export interface AiResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  provider: "openai" | "anthropic";
  model: string;
}

/** Default request timeout for a single AI call (ms). */
const AI_TIMEOUT_MS = 90_000;

/**
 * Unified completion with provider fallback, retry and timeout.
 * - tries configured/preferred provider (or explicit `provider` override)
 * - falls back to the other provider when the primary key is missing or the
 *   primary call fails with an auth/config error
 * - wraps every attempt with exponential-backoff retry + timeout
 * - records the run for cost tracking (fire-and-forget)
 */
export async function aiComplete(model: AiModelConfig, options: AiCompleteOptions): Promise<AiResult> {
  const primary: AiModelConfig = options.provider ? { ...model, provider: options.provider } : model;

  const attempts: AiModelConfig[] = [primary];
  const fallback: "openai" | "anthropic" | null =
    primary.provider === "openai"
      ? process.env.ANTHROPIC_API_KEY
        ? "anthropic"
        : null
      : process.env.OPENAI_API_KEY
        ? "openai"
        : null;

  if (fallback) {
    attempts.push({ ...primary, provider: fallback });
  }

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(
        withRetry(
          () =>
            attempt.provider === "openai"
              ? completeOpenAI(attempt, options)
              : completeAnthropic(attempt, options),
          { attempts: 3, baseDelayMs: 500, maxDelayMs: 6_000 }
        ),
        AI_TIMEOUT_MS,
        "AI request timed out"
      );

      const aiResult: AiResult = {
        ...result,
        provider: attempt.provider,
        model: attempt.model,
      };

      // fire-and-forget cost tracking; never blocks or throws to the caller
      void recordAiRun({
        module: options.module ?? "ai",
        model: attempt.model,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        costUsd: result.costUsd,
        ownerId: options.ownerId,
        latencyMs: Date.now() - startedAt,
      });

      return aiResult;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // only fall back when the primary failed due to missing/unauthorized key
      if (!/api.?key|not set|401|403/i.test(lastError.message)) break;
    }
  }

  throw lastError ?? new Error("AI completion failed");
}

/** Robust JSON extraction from an AI response (handles markdown fences). */
export function parseAiJson<T>(raw: string): T {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  return JSON.parse(cleaned) as T;
}

/** Wrap a prompt to force strict JSON output. */
export function jsonPrompt(system: string, schemaHint: string): { system: string; prompt: string } {
  return {
    system: `${system}\n\nYou must respond with VALID JSON ONLY. No markdown fences. No prose outside the JSON.`,
    prompt: `Return a JSON object matching exactly this shape:\n${schemaHint}`,
  };
}
