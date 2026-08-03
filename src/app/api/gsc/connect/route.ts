import { NextResponse } from "next/server";

import { resolveOwnerId } from "@/lib/owner";
import { buildOAuthState } from "@/lib/gsc/oauth-state";

const GSC_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

/** GET /api/gsc/connect — starts the Google OAuth flow. */
export async function GET(request: Request): Promise<NextResponse> {
  const clientId = process.env.GSC_CLIENT_ID;
  const redirectUri = process.env.GSC_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "GSC_CLIENT_ID / GSC_REDIRECT_URI are not configured" },
      { status: 503 }
    );
  }

  const ownerId = resolveOwnerId(new URL(request.url).searchParams.get("ownerId"));
  const state = buildOAuthState(ownerId);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GSC_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`${GSC_AUTH_BASE}?${params.toString()}`);
}
