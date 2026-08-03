import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runSalesDaily } from "@/lib/sales/server";

interface SalesDailyBody {
  ownerId?: unknown;
  date?: unknown;
}

/** Weekday (or on-demand) cron: run the daily sales queue + briefing. */
export const POST = withRouteHandler<SalesDailyBody>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" && body.ownerId.trim() ? body.ownerId.trim() : "system";
    const date = typeof body?.date === "string" && body.date.trim() ? body.date.trim() : undefined;
    const result = await runSalesDaily(ownerId, { date });
    return NextResponse.json(result);
  },
  {
    requireCronAuth: true,
  }
);
