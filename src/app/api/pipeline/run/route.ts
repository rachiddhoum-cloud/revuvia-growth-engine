import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { createServiceRoleClient } from "@/lib/supabase";
import { runPipeline, createPipelineExecutors, SupabasePipelineStore } from "@/lib/pipeline";

interface RunBody {
  keyword?: unknown;
  ownerId?: unknown;
  autoApprove?: unknown;
  stopAt?: unknown;
  appUrl?: unknown;
}

/**
 * Runs the autonomous editorial pipeline for a keyword.
 * - Defaults to auto-approve off (human gate at the `approval` stage).
 * - Requires a valid `keyword`.
 * - Returns the run result (stages, current status, stop point).
 */
export const POST = withRouteHandler<RunBody>(async (body) => {
  const keyword = typeof body?.keyword === "string" ? body.keyword.trim() : "";
  if (!keyword || keyword.length > 300) {
    throw ApiError.badRequest("A valid keyword is required");
  }
  const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
  const autoApprove = body?.autoApprove === true;
  const stopAt =
    typeof body?.stopAt === "string" && body.stopAt.length > 0
      ? (body.stopAt as never)
      : undefined;
  const appUrl = typeof body?.appUrl === "string" ? body.appUrl : undefined;

  const sb = createServiceRoleClient();
  const store = new SupabasePipelineStore(sb, ownerId);
  const executors = createPipelineExecutors({ store, appUrl });

  const result = await runPipeline(keyword, { store, executors, autoApprove, stopAt }, ownerId);
  return NextResponse.json({ ok: true, result });
}, { rateLimit: { limiter: aiRateLimiter } });
