import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runOutreachQueue } from "@/lib/ops/execute";

interface OutreachBody {
  ownerId?: unknown;
}

/** Friday cron: rebuild the backlink outreach queue from GSC + Ahrefs data. */
export const POST = withRouteHandler<OutreachBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await runOutreachQueue(ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
