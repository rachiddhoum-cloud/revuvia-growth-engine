import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase";
import { listPendingApprovals } from "@/lib/pipeline/pending";
import { resolveOwnerId } from "@/lib/owner";

export const dynamic = "force-dynamic";

/** GET /api/pipeline/pending — content awaiting human approval. */
export async function GET(request: Request): Promise<NextResponse> {
  const ownerId = resolveOwnerId(new URL(request.url).searchParams.get("ownerId"));
  const sb = createServiceRoleClient();
  const items = await listPendingApprovals(sb, ownerId);
  return NextResponse.json({ ok: true, items, ownerId });
}
