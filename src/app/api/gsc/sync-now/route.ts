import { NextResponse } from "next/server";

import { ApiError, withRouteHandler } from "@/lib/http";
import { aiRateLimiter } from "@/lib/reliability";
import { runGscSync } from "@/lib/gsc/sync";
import { isGscEnvConfigured } from "@/lib/gsc/status";
import { resolveOwnerId } from "@/lib/owner";

interface SyncNowBody {
  ownerId?: unknown;
}

/** POST /api/gsc/sync-now — manual sync from Settings (rate-limited). */
export const POST = withRouteHandler<SyncNowBody>(
  async (body) => {
    if (!isGscEnvConfigured()) {
      throw ApiError.serviceUnavailable("GSC OAuth is not configured. Set GSC_CLIENT_ID, GSC_CLIENT_SECRET and GSC_REDIRECT_URI.");
    }
    const ownerId = resolveOwnerId(typeof body?.ownerId === "string" ? body.ownerId : null);
    const result = await runGscSync(ownerId);
    return NextResponse.json(result);
  },
  { rateLimit: { limiter: aiRateLimiter, keyPrefix: "gsc-sync" } }
);
