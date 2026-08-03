import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runPublishing } from "@/lib/ops/execute";

interface PublishBody {
  ownerId?: unknown;
}

/** Daily cron: creates the multi-platform queue and publishes due slots. */
export const POST = withRouteHandler<PublishBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await runPublishing(ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
