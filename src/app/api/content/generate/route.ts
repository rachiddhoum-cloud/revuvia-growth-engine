import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { generateContent } from "@/lib/content";

interface GenerateBody {
  keyword?: unknown;
  kind?: unknown;
  audience?: unknown;
  extraInstructions?: unknown;
}

export const POST = withRouteHandler<GenerateBody>(async (body) => {
  const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword || keyword.length > 200) {
    throw ApiError.badRequest("A valid keyword is required");
  }

  const kind = body?.kind === "landing" || body?.kind === "faq" ? body.kind : "article";
  const audience = typeof body?.audience === "string" ? body.audience : undefined;
  const extraInstructions =
    typeof body?.extraInstructions === "string" ? body.extraInstructions : undefined;

  const content = await generateContent({ keyword, kind, audience, extraInstructions });
  return NextResponse.json({ content });
}, { rateLimit: { limiter: aiRateLimiter } });
