/**
 * AI provider barrel export.
 */

export { resolveProvider, heavyModel, fastModel, fallbackProvider, hasAnyKey } from "@/lib/ai/config";
export type { AiProviderName, AiModelConfig } from "@/lib/ai/config";
export { aiComplete, parseAiJson, jsonPrompt } from "@/lib/ai/provider";
export type { AiResult, AiCompleteOptions } from "@/lib/ai/provider";
