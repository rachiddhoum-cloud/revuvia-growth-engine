import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { analyzeSeedKeyword } from "@/lib/seo";

interface AnalyzeBody {
  keyword?: unknown;
}

export const POST = withRouteHandler<AnalyzeBody>(async (body) => {
  const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword || keyword.length > 200) {
    throw ApiError.badRequest("A valid keyword is required");
  }

  const report = await analyzeSeedKeyword(keyword);
  return NextResponse.json({ report });
}, { rateLimit: { limiter: aiRateLimiter } });
