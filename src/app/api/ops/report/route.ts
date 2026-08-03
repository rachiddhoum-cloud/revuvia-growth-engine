import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { generateOpsArtifact } from "@/lib/ops/generate";

interface ReportBody {
  ownerId?: unknown;
}

/** Generates + persists the weekly CEO report (Monday cron, PDF-ready HTML). */
export const POST = withRouteHandler<ReportBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await generateOpsArtifact("ceo_report", ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
