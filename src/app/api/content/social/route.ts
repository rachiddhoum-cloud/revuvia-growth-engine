import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { transformToSocial } from "@/lib/content";
import type { SocialPlatform } from "@/types";

const VALID_PLATFORMS = new Set<SocialPlatform>(["linkedin", "facebook", "instagram", "x", "email", "video"]);

interface SocialBody {
  title?: unknown;
  excerpt?: unknown;
  bodyMarkdown?: unknown;
  platforms?: unknown;
}

export const POST = withRouteHandler<SocialBody>(async (body) => {
  const title = typeof body?.title === "string" ? body.title : "Untitled";
  const excerpt = typeof body?.excerpt === "string" ? body.excerpt : "";
  const bodyMarkdown = typeof body?.bodyMarkdown === "string" ? body.bodyMarkdown : "";
  if (!bodyMarkdown) {
    throw ApiError.badRequest("bodyMarkdown is required");
  }

  const rawPlatforms = Array.isArray(body?.platforms) ? body.platforms : ["linkedin", "x"];
  const platforms = rawPlatforms.filter(
    (p): p is SocialPlatform => typeof p === "string" && VALID_PLATFORMS.has(p as SocialPlatform)
  );

  const posts = await transformToSocial({ title, excerpt, bodyMarkdown }, platforms);
  return NextResponse.json({ posts });
}, { rateLimit: { limiter: aiRateLimiter } });
