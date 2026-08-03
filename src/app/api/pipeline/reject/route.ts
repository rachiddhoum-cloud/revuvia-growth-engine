import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { createServiceRoleClient } from "@/lib/supabase";
import { rejectPipeline, SupabasePipelineStore } from "@/lib/pipeline";
import { resolveOwnerId } from "@/lib/owner";

interface RejectBody {
  contentId?: unknown;
  ownerId?: unknown;
  reason?: unknown;
}

/** Rejects a pipeline paused at approval and returns the item to draft. */
export const POST = withRouteHandler<RejectBody>(async (body) => {
  const contentId = typeof body?.contentId === "string" ? body.contentId.trim() : "";
  if (!contentId) {
    throw ApiError.badRequest("contentId is required");
  }
  const ownerId = resolveOwnerId(typeof body?.ownerId === "string" ? body.ownerId : null);
  const reason =
    typeof body?.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 500)
      : "Rejected by reviewer";

  const sb = createServiceRoleClient();
  const store = new SupabasePipelineStore(sb, ownerId);
  await rejectPipeline(contentId, { store }, reason);

  return NextResponse.json({ ok: true, contentId, status: "draft" });
}, { rateLimit: { limiter: aiRateLimiter } });
