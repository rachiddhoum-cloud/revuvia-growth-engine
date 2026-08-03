import OpenAI from "openai";

import type { AiModelConfig } from "@/lib/ai/config";

let client: OpenAI | null = null;

const OPENAI_TIMEOUT_MS = 90_000;
const OPENAI_MAX_RETRIES = 2;

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: OPENAI_TIMEOUT_MS,
      maxRetries: OPENAI_MAX_RETRIES,
    });
  }
  return client;
}

export interface CompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

const OPENAI_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 }, // per 1M tokens (USD)
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
};

export async function completeOpenAI(
  model: AiModelConfig,
  options: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: "text" | "json";
  }
): Promise<CompletionResult> {
  const openai = getOpenAIClient();
  const response = await openai.responses.create({
    model: model.model,
    instructions: options.system,
    input: options.prompt,
    max_output_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    ...(options.responseFormat === "json" ? { text: { format: { type: "json_object" } } } : {}),
  });

  const text = response.output_text ?? "";
  const usage = response.usage;
  const promptTokens = usage?.input_tokens ?? 0;
  const completionTokens = usage?.output_tokens ?? 0;
  const pricing = OPENAI_PRICING[model.model] ?? { input: 2.5, output: 10 };
  const costUsd = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

  return { content: text, promptTokens, completionTokens, costUsd };
}
