import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runSalesAnalytics } from "@/lib/sales/server";

interface SalesAnalyticsBody {
  ownerId?: unknown;
}

/** Monday (or on-demand) cron: sales analytics + CEO report + learning. */
export const POST = withRouteHandler<SalesAnalyticsBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const result = await runSalesAnalytics(ownerId);
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
