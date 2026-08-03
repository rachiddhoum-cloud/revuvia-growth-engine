import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { buildCasFounderBriefing } from "@/lib/acquisition/founder-briefing";

interface Body {
  ownerId?: unknown;
}

/** Daily cron — 2-minute founder briefing. */
export const POST = withRouteHandler<Body>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "system";
    const briefing = await buildCasFounderBriefing(ownerId);
    return NextResponse.json({ ok: true, briefing });
  },
  { requireCronAuth: true }
);

export const GET = withRouteHandler<Body>(
  async () => {
    const briefing = await buildCasFounderBriefing();
    return NextResponse.json(briefing);
  }
);
