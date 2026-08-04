import { afterEach, describe, expect, it } from "vitest";

import {
  configuredProviders,
  getGeminiApiKey,
  heavyModel,
  resolveProvider,
} from "@/lib/ai/config";
import { resetServerEnvCache } from "@/lib/env/server";

function withEnv(vars: Record<string, string | undefined>): void {
  resetServerEnvCache();
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  resetServerEnvCache();
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_PROVIDER;
});

describe("AI provider config", () => {
  it("reads Gemini key from GEMINI_API_KEY or GOOGLE_AI_API_KEY", () => {
    withEnv({ GEMINI_API_KEY: "gem-key" });
    expect(getGeminiApiKey()).toBe("gem-key");

    withEnv({ GEMINI_API_KEY: undefined, GOOGLE_AI_API_KEY: "google-key" });
    expect(getGeminiApiKey()).toBe("google-key");
  });

  it("prefers gemini in auto mode when only gemini is configured", () => {
    withEnv({ GEMINI_API_KEY: "gem-key", AI_PROVIDER: "auto" });
    expect(resolveProvider()).toBe("gemini");
    expect(configuredProviders()).toEqual(["gemini"]);
    expect(heavyModel()).toEqual({ provider: "gemini", model: "gemini-2.0-flash" });
  });

  it("respects explicit AI_PROVIDER=gemini", () => {
    withEnv({
      GEMINI_API_KEY: "gem-key",
      OPENAI_API_KEY: "oai-key",
      AI_PROVIDER: "gemini",
    });
    expect(resolveProvider()).toBe("gemini");
  });

  it("falls back to openai when gemini key missing", () => {
    withEnv({ OPENAI_API_KEY: "oai-key", AI_PROVIDER: "auto" });
    expect(resolveProvider()).toBe("openai");
    expect(configuredProviders()).toEqual(["openai"]);
  });
});
