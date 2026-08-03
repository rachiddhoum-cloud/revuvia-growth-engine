import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { generateOpsArtifact } from "@/lib/ops/generate";

interface PlanBody {
  ownerId?: unknown;
}

/** Generates + persists the weekly TOP 10 action plan (Monday cron). */
export const POST = withRouteHandler<PlanBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await generateOpsArtifact("action_plan", ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
