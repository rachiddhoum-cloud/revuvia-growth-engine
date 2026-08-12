import { NextResponse } from "next/server";

import { verifyGscConnectToken } from "@/lib/gsc/connect-link";
import { buildOAuthState } from "@/lib/gsc/oauth-state";

const GSC_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";

export const runtime = "nodejs";

/**
 * GET /api/public/gsc-connect?token=…
 * Redirige vers Google OAuth sans login ops (lien signé, 30 min).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const verification = verifyGscConnectToken(url.searchParams.get("token"));
  if (!verification.ok) {
    return NextResponse.json({ error: "Invalid or expired link", reason: verification.reason }, { status: 401 });
  }

  const clientId = process.env.GSC_CLIENT_ID;
  const redirectUri = process.env.GSC_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "GSC OAuth is not configured on this deployment" }, { status: 503 });
  }

  const state = buildOAuthState(verification.ownerId);
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
