import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { generateLeadMagnet } from "@/lib/leadmagnet";
import type { LeadMagnetKind } from "@/types";

const VALID_KINDS: LeadMagnetKind[] = ["checklist", "guide", "template", "ebook", "worksheet", "pdf"];
const VALID_KINDS_SET = new Set<string>(VALID_KINDS);

interface LeadMagnetBody {
  topic?: unknown;
  kind?: unknown;
  audience?: unknown;
}

export const POST = withRouteHandler<LeadMagnetBody>(async (body) => {
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  if (!topic || topic.length > 200) {
    throw ApiError.badRequest("A valid topic is required");
  }

  const kind: LeadMagnetKind =
    typeof body?.kind === "string" && VALID_KINDS_SET.has(body.kind)
      ? (body.kind as LeadMagnetKind)
      : "checklist";
  const audience = typeof body?.audience === "string" ? body.audience : undefined;

  const output = await generateLeadMagnet({ topic, kind, audience });
  return NextResponse.json({ output });
}, { rateLimit: { limiter: aiRateLimiter } });
