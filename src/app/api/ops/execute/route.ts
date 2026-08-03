import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { executeWeeklyLoop } from "@/lib/ops/execute";

interface ExecuteBody {
  ownerId?: unknown;
}

/** Monday cron: linking plan, SEO loop, lead loop, opportunities, calendar, score. */
export const POST = withRouteHandler<ExecuteBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await executeWeeklyLoop(ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
