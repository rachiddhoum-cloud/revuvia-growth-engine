import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runGscSync } from "@/lib/gsc/sync";

interface SyncBody {
  ownerId?: unknown;
}

/** POST /api/gsc/sync — cron: GSC sync + automation chain. */
export const POST = withRouteHandler<SyncBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await runGscSync(ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
