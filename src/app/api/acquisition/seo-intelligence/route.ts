import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { runSeoIntelligenceCycle } from "@/lib/acquisition/seo-intelligence";

interface Body {
  ownerId?: unknown;
}

/** Weekly cron — SEO intelligence loop. */
export const POST = withRouteHandler<Body>(
  async (body) => {
    const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "system";
    const report = await runSeoIntelligenceCycle(ownerId);
    return NextResponse.json({ ok: true, report });
  },
  { requireCronAuth: true }
);
