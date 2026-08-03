import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runFounderInbox } from "@/lib/ops/execute";

interface InboxBody {
  ownerId?: unknown;
}

/** Daily 07:00 cron: founder inbox with today's top 5 (≤ 2 min read). */
export const POST = withRouteHandler<InboxBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await runFounderInbox(ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
