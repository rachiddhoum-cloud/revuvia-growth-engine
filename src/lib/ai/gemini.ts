import { GoogleGenerativeAI } from "@google/generative-ai";

import type { AiModelConfig } from "@/lib/ai/config";
import { getGeminiApiKey } from "@/lib/ai/config";

let client: GoogleGenerativeAI | null = null;

const GEMINI_TIMEOUT_MS = 90_000;

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  if (!client) {
    client = new GoogleGenerativeAI(apiKey);
  }
  return client;
}

export interface CompletionResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

const GEMINI_PRICING: Record<string, { input: number; output: number }> = {
  "gemini-flash-latest": { input: 0.1, output: 0.4 },
  "gemini-flash-lite-latest": { input: 0.075, output: 0.3 },
  "gemini-2.0-flash": { input: 0.1, output: 0.4 },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.3 },
  "gemini-1.5-flash": { input: 0.075, output: 0.3 },
};

export async function completeGemini(
  model: AiModelConfig,
  options: {
    system?: string;
    prompt: string;
    maxTokens?: number;
    temperature?: number;
    responseFormat?: "text" | "json";
  }
): Promise<CompletionResult> {
  const genAI = getGeminiClient();
  const generativeModel = genAI.getGenerativeModel({
    model: model.model,
    systemInstruction: options.system ?? undefined,
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 8192,
      temperature: options.temperature ?? 0.7,
      ...(options.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
    },
  });

  const result = await Promise.race([
    generativeModel.generateContent(options.prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Gemini request timed out")), GEMINI_TIMEOUT_MS)
    ),
  ]);

  const response = result.response;
  const content = response.text();
  const usage = response.usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const completionTokens = usage?.candidatesTokenCount ?? 0;
  const pricing = GEMINI_PRICING[model.model] ?? { input: 0.1, output: 0.4 };
  const costUsd = (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;

  return { content, promptTokens, completionTokens, costUsd };
}
