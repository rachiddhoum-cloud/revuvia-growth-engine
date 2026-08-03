import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runAhrefsSync } from "@/lib/ahrefs/server";

interface SyncBody {
  ownerId?: unknown;
}

/** POST /api/ahrefs/sync — weekly cron: pull real backlinks for the target domain. */
export const POST = withRouteHandler<SyncBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await runAhrefsSync(ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
