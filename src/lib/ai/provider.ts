import type { AiModelConfig, AiProviderName } from "@/lib/ai/config";
import {
  configuredProviders,
  modelForProvider,
  modelTierFor,
  resolveProvider,
} from "@/lib/ai/config";
import { completeOpenAI } from "@/lib/ai/openai";
import { completeAnthropic } from "@/lib/ai/anthropic";
import { completeGemini } from "@/lib/ai/gemini";
import { withRetry, withTimeout } from "@/lib/reliability";
import { recordAiRun } from "@/lib/monitoring";

export interface AiCompleteOptions {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
  /** Optional explicit provider override. */
  provider?: AiProviderName;
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
  provider: AiProviderName;
  model: string;
}

/** Default request timeout for a single AI call (ms). */
const AI_TIMEOUT_MS = 90_000;

function completeForProvider(
  attempt: AiModelConfig,
  options: AiCompleteOptions
): Promise<{
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}> {
  switch (attempt.provider) {
    case "openai":
      return completeOpenAI(attempt, options);
    case "anthropic":
      return completeAnthropic(attempt, options);
    case "gemini":
      return completeGemini(attempt, options);
    default: {
      const neverProvider: never = attempt.provider;
      throw new Error(`Unknown AI provider: ${neverProvider}`);
    }
  }
}

function buildProviderAttempts(model: AiModelConfig, options: AiCompleteOptions): AiModelConfig[] {
  const tier = modelTierFor(model);
  const primary = resolveProvider(options.provider ?? model.provider);
  const rest = configuredProviders().filter((p) => p !== primary);
  return [primary, ...rest].map((provider) => modelForProvider(provider, tier));
}

/**
 * Unified completion with provider fallback, retry and timeout.
 * - tries configured/preferred provider (or explicit `provider` override)
 * - falls back to other configured providers when the primary call fails
 * - wraps every attempt with exponential-backoff retry + timeout
 * - records the run for cost tracking (fire-and-forget)
 */
export async function aiComplete(model: AiModelConfig, options: AiCompleteOptions): Promise<AiResult> {
  const attempts = buildProviderAttempts(model, options);
  let lastError: Error | null = null;

  for (const attempt of attempts) {
    const startedAt = Date.now();
    try {
      const result = await withTimeout(
        withRetry(
          () => completeForProvider(attempt, options),
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
