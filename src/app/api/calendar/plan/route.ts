import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { generateCalendarPlan } from "@/lib/calendar";

interface CalendarBody {
  startDate?: unknown;
  frequency?: unknown;
}

export const POST = withRouteHandler<CalendarBody>(async (body) => {
  const startDate =
    typeof body?.startDate === "string" && !Number.isNaN(Date.parse(body.startDate))
      ? body.startDate
      : new Date().toISOString();
  const frequency = body?.frequency === "daily" || body?.frequency === "monthly" ? body.frequency : "weekly";

  const plan = generateCalendarPlan({ startDate, frequency });
  return NextResponse.json({ plan });
}, { rateLimit: { limiter: aiRateLimiter } });
