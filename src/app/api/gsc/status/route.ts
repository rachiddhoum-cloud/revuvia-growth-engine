import { NextResponse } from "next/server";

import { loadGscConnectionStatus } from "@/lib/gsc/status";
import { resolveOwnerId } from "@/lib/owner";

export const dynamic = "force-dynamic";

/** GET /api/gsc/status — connection status for the Settings UI (no secrets). */
export async function GET(request: Request): Promise<NextResponse> {
  const ownerId = resolveOwnerId(new URL(request.url).searchParams.get("ownerId"));
  const status = await loadGscConnectionStatus(ownerId);
  return NextResponse.json(status);
}
