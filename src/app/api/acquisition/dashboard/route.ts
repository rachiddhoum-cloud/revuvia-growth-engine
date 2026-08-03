import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { loadAcquisitionDashboard } from "@/lib/acquisition/dashboard";

interface Body {
  ownerId?: unknown;
}

export const POST = withRouteHandler<Body>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "system";
    const model = await loadAcquisitionDashboard(ownerId);
    return NextResponse.json(model);
  },
  { requireCronAuth: true }
);

export const GET = withRouteHandler<Body>(
  async () => {
    const model = await loadAcquisitionDashboard();
    return NextResponse.json(model);
  }
);
