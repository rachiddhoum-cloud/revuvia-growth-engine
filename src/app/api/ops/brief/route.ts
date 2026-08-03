import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { generateOpsArtifact } from "@/lib/ops/generate";

interface BriefBody {
  ownerId?: unknown;
}

/** Generates + persists the founder daily brief (morning cron, < 3 min). */
export const POST = withRouteHandler<BriefBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await generateOpsArtifact("daily_brief", ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
