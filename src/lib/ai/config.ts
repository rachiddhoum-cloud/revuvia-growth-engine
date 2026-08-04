/**
 * AI provider configuration.
 * Supports Gemini, OpenAI and Anthropic, with automatic fallback.
 * Reads from the validated server environment (fail-fast when invalid).
 */

import { getServerEnv } from "@/lib/env/server";

export type AiProviderName = "openai" | "anthropic" | "gemini";

export interface AiModelConfig {
  provider: AiProviderName;
  model: string;
}

const PROVIDER_ORDER: AiProviderName[] = ["gemini", "openai", "anthropic"];

function env(): {
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
  AI_PROVIDER?: string;
} {
  try {
    const e = getServerEnv();
    return {
      OPENAI_API_KEY: e.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: e.ANTHROPIC_API_KEY,
      GEMINI_API_KEY: e.GEMINI_API_KEY,
      GOOGLE_AI_API_KEY: e.GOOGLE_AI_API_KEY,
      AI_PROVIDER: e.AI_PROVIDER,
    };
  } catch {
    return {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
      AI_PROVIDER: process.env.AI_PROVIDER,
    };
  }
}

/** Gemini key from GEMINI_API_KEY or GOOGLE_AI_API_KEY (AI Studio). */
export function getGeminiApiKey(): string | undefined {
  const e = env();
  const key = e.GEMINI_API_KEY ?? e.GOOGLE_AI_API_KEY;
  return key?.trim() ? key.trim() : undefined;
}

export function hasProviderKey(provider: AiProviderName): boolean {
  const e = env();
  switch (provider) {
    case "openai":
      return Boolean(e.OPENAI_API_KEY);
    case "anthropic":
      return Boolean(e.ANTHROPIC_API_KEY);
    case "gemini":
      return Boolean(getGeminiApiKey());
    default: {
      const neverProvider: never = provider;
      throw new Error(`Unknown AI provider: ${neverProvider}`);
    }
  }
}

/** Configured providers in fallback priority (Gemini first for free-tier usage). */
export function configuredProviders(): AiProviderName[] {
  return PROVIDER_ORDER.filter(hasProviderKey);
}

/** Resolve the active provider given an optional explicit preference. */
export function resolveProvider(preferred?: AiProviderName): AiProviderName {
  const e = env();
  const configured = preferred ?? e.AI_PROVIDER;
  if (configured === "openai" || configured === "anthropic" || configured === "gemini") {
    if (hasProviderKey(configured)) return configured;
  }
  const available = configuredProviders();
  if (available.length > 0) return available[0];
  return "gemini";
}

/** Heavy model for deep reasoning / long content. */
export function heavyModel(preferredProvider?: AiProviderName): AiModelConfig {
  const provider = resolveProvider(preferredProvider);
  switch (provider) {
    case "anthropic":
      return { provider, model: "claude-sonnet-4-5-20250929" };
    case "gemini":
      return { provider, model: "gemini-2.0-flash" };
    case "openai":
      return { provider, model: "gpt-4o" };
    default: {
      const neverProvider: never = provider;
      throw new Error(`Unknown AI provider: ${neverProvider}`);
    }
  }
}

/** Fast model for classification / short transforms. */
export function fastModel(preferredProvider?: AiProviderName): AiModelConfig {
  const provider = resolveProvider(preferredProvider);
  switch (provider) {
    case "anthropic":
      return { provider, model: "claude-3-5-haiku-20241022" };
    case "gemini":
      return { provider, model: "gemini-2.0-flash-lite" };
    case "openai":
      return { provider, model: "gpt-4o-mini" };
    default: {
      const neverProvider: never = provider;
      throw new Error(`Unknown AI provider: ${neverProvider}`);
    }
  }
}

/** The next configured provider (fallback target), if any. */
export function fallbackProvider(preferred?: AiProviderName): AiProviderName | null {
  const primary = resolveProvider(preferred);
  const rest = configuredProviders().filter((p) => p !== primary);
  return rest[0] ?? null;
}

export function hasAnyKey(): boolean {
  return configuredProviders().length > 0;
}

/** Infer heavy vs fast tier when switching providers during fallback. */
export function modelTierFor(model: AiModelConfig): "heavy" | "fast" {
  const heavy = heavyModel(model.provider);
  return model.model === heavy.model ? "heavy" : "fast";
}

export function modelForProvider(provider: AiProviderName, tier: "heavy" | "fast"): AiModelConfig {
  return tier === "heavy" ? heavyModel(provider) : fastModel(provider);
}
