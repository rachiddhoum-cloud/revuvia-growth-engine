import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runCasLearningCycle } from "@/lib/acquisition/learning";

interface Body {
  ownerId?: unknown;
}

/** Weekly cron — autonomous CAS learning. */
export const POST = withRouteHandler<Body>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "system";
    const insights = await runCasLearningCycle(ownerId);
    return NextResponse.json({ ok: true, insights });
  },
  { requireCronAuth: true }
);
