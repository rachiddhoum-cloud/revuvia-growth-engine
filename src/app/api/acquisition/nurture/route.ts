import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runNurtureCycle } from "@/lib/acquisition/nurture";

interface Body {
  ownerId?: unknown;
}

/** Daily cron — send due nurture emails. */
export const POST = withRouteHandler<Body>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "system";
    const result = await runNurtureCycle(ownerId);
    return NextResponse.json({ ok: true, ...result });
  },
  { requireCronAuth: true }
);
