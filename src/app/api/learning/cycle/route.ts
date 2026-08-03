import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runLearningCycle } from "@/lib/learning/server";

interface LearningBody {
  ownerId?: unknown;
}

/** Monday (or on-demand) cron: run the autonomous learning cycle. */
export const POST = withRouteHandler<LearningBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await runLearningCycle(ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
