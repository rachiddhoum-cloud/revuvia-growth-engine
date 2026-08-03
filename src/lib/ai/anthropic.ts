import Anthropic from "@anthropic-ai/sdk";

import type { AiModelConfig } from "@/lib/ai/config";

let client: Anthropic | null = null;

const ANTHROPIC_TIMEOUT_MS = 90_000;
const ANTHROPIC_MAX_RETRIES = 2;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: ANTHROPIC_TIMEOUT_MS,
      maxRetries: ANTHROPIC_MAX_RETRIES,
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

const ANTHROPIC_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-5-20250929": { input: 3, output: 15 }, // per 1M tokens (USD)
  "claude-3-5-haiku-20241022": { input: 0.8, output: 4 },
};

export async function completeAnthropic(
  model: AiModelConfig,
  options: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: "text" | "json";
  }
): Promise<CompletionResult> {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: model.model,
    system: options.system,
    max_tokens: options.maxTokens ?? 4096,
    temperature: options.temperature ?? 0.7,
    messages: [{ role: "user", content: options.prompt }],
  });

  const content = response.content
    .filter((block) => block.type === "text")
    .map((block) => (block as Anthropic.TextBlock).text)
    .join("");

  const promptTokens = response.usage.input_tokens ?? 0;
  const completionTokens = response.usage.output_tokens ?? 0;
  const pricing = ANTHROPIC_PRICING[model.model] ?? { input: 3, output: 15 };
  const costUsd = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

  return { content, promptTokens, completionTokens, costUsd };
}
