import { NextResponse } from "next/server";

import { checkDbHealth, createServiceRoleClient } from "@/lib/supabase";
import { serverEnvStatus } from "@/lib/env";
import { isResendConfigured } from "@/lib/email";
import { hasAnyKey, getGeminiApiKey } from "@/lib/ai";
import { isGscEnvConfigured } from "@/lib/gsc/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const env = serverEnvStatus();

  let dbOk = false;
  let dbError: string | undefined;
  let latencyMs = 0;

  if (env.ok) {
    const health = await checkDbHealth(createServiceRoleClient(), 5_000);
    dbOk = health.ok;
    dbError = health.error;
    latencyMs = health.latencyMs;
  }

  const status = {
    ok: env.ok && dbOk,
    env: {
      ok: env.ok,
      missing: env.missing,
      invalid: env.invalid.map((i) => `${i.key}: ${i.message}`),
    },
    services: {
      supabase: { configured: env.ok, ok: dbOk, latencyMs, error: dbError },
      openai: { configured: Boolean(process.env.OPENAI_API_KEY) },
      anthropic: { configured: Boolean(process.env.ANTHROPIC_API_KEY) },
      gemini: { configured: Boolean(getGeminiApiKey()) },
      ai: { configured: hasAnyKey() },
      resend: { configured: isResendConfigured() },
      gsc: { configured: isGscEnvConfigured() },
    },
    ts: new Date().toISOString(),
  };

  return NextResponse.json(status, { status: status.ok ? 200 : 503 });
}
