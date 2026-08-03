import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { createServiceRoleClient } from "@/lib/supabase";
import {
  approvePipeline,
  createPipelineExecutors,
  runPipeline,
  SupabasePipelineStore,
} from "@/lib/pipeline";
import { resolveOwnerId } from "@/lib/owner";

interface ApproveBody {
  contentId?: unknown;
  ownerId?: unknown;
  appUrl?: unknown;
}

/**
 * Approves a pipeline paused at the `approval` stage (human gate),
 * then resumes publish → published → performance automatically.
 */
export const POST = withRouteHandler<ApproveBody>(async (body) => {
  const contentId = typeof body?.contentId === "string" ? body.contentId.trim() : "";
  if (!contentId) {
    throw ApiError.badRequest("contentId is required");
  }
  const ownerId = resolveOwnerId(typeof body?.ownerId === "string" ? body.ownerId : null);
  const appUrl = typeof body?.appUrl === "string" ? body.appUrl : undefined;

  const sb = createServiceRoleClient();
  const store = new SupabasePipelineStore(sb, ownerId);
  const executors = createPipelineExecutors({ store, appUrl });

  const approval = await approvePipeline(contentId, { store, executors });

  const item = await store.getContentItem(contentId);
  const keyword = item?.keyword ?? item?.title ?? contentId;
  const resumed = await runPipeline(keyword, { store, executors, autoApprove: true }, ownerId);

  return NextResponse.json({ ok: true, approval, resumed });
}, { rateLimit: { limiter: aiRateLimiter } });
