/**
 * AI provider configuration.
 * Supports OpenAI and Anthropic, with automatic fallback.
 * Reads from the validated server environment (fail-fast when invalid).
 */

import { getServerEnv } from "@/lib/env/server";

export type AiProviderName = "openai" | "anthropic";

export interface AiModelConfig {
  provider: AiProviderName;
  model: string;
}

function env(): { OPENAI_API_KEY?: string; ANTHROPIC_API_KEY?: string; AI_PROVIDER?: string } {
  try {
    const e = getServerEnv();
    return {
      OPENAI_API_KEY: e.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY,
      AI_PROVIDER: e.AI_PROVIDER,
    };
  } catch {
    // Fall back to raw process.env so AI libs can still report a clean error.
    return {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      AI_PROVIDER: process.env.AI_PROVIDER,
    };
  }
}

/** Resolve the active provider given an optional explicit preference. */
export function resolveProvider(preferred?: AiProviderName): AiProviderName {
  const e = env();
  const configured = preferred ?? e.AI_PROVIDER;
  if (configured === "openai" || configured === "anthropic") return configured;
  if (e.OPENAI_API_KEY) return "openai";
  if (e.ANTHROPIC_API_KEY) return "anthropic";
  return "openai";
}

/** Heavy model for deep reasoning / long content. */
export function heavyModel(preferredProvider?: AiProviderName): AiModelConfig {
  const provider = resolveProvider(preferredProvider);
  return provider === "anthropic"
    ? { provider, model: "claude-sonnet-4-5-20250929" }
    : { provider, model: "gpt-4o" };
}

/** Fast model for classification / short transforms. */
export function fastModel(preferredProvider?: AiProviderName): AiModelConfig {
  const provider = resolveProvider(preferredProvider);
  return provider === "anthropic"
    ? { provider, model: "claude-3-5-haiku-20241022" }
    : { provider, model: "gpt-4o-mini" };
}

/** The other provider configured (fallback target), if any. */
export function fallbackProvider(preferred?: AiProviderName): AiProviderName | null {
  const e = env();
  const primary = resolveProvider(preferred);
  if (primary === "openai") return e.ANTHROPIC_API_KEY ? "anthropic" : null;
  return e.OPENAI_API_KEY ? "openai" : null;
}

export function hasAnyKey(): boolean {
  const e = env();
  return Boolean(e.OPENAI_API_KEY || e.ANTHROPIC_API_KEY);
}
