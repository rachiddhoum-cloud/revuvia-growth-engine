import { NextResponse } from "next/server";

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/log/logger";
import { createGscClient, exchangeAuthorizationCode } from "@/lib/gsc/connector";
import { verifyOAuthState } from "@/lib/gsc/oauth-state";
import { ApiError } from "@/lib/http";

/** GET /api/gsc/callback?code=...&state=... — exchanges the OAuth code, stores credentials. */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error");

  const verification = verifyOAuthState(url.searchParams.get("state"));
  if (!verification.ok || !verification.ownerId) {
    return NextResponse.redirect(
      new URL(`/settings?gsc=error&reason=${verification.reason}`, process.env.NEXT_PUBLIC_APP_URL ?? "/")
    );
  }
  const ownerId = verification.ownerId;

  if (errorParam) {
    return NextResponse.redirect(
      new URL("/settings?gsc=error&reason=" + encodeURIComponent(errorParam), process.env.NEXT_PUBLIC_APP_URL ?? "/")
    );
  }
  if (!code) {
    return NextResponse.redirect(
      new URL("/settings?gsc=error&reason=missing_code", process.env.NEXT_PUBLIC_APP_URL ?? "/")
    );
  }

  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  const redirectUri = process.env.GSC_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw ApiError.serviceUnavailable("GSC_CLIENT_ID / GSC_CLIENT_SECRET / GSC_REDIRECT_URI are not configured");
  }

  const sb = createServiceRoleClient();

  try {
    const tokens = await exchangeAuthorizationCode(code, clientId, clientSecret, redirectUri);

    const gsc = createGscClient(
      { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt, siteUrl: "" },
      { minIntervalMs: 100 }
    );
    const sites = await gsc.listSites();
    if (sites.length === 0) {
      return NextResponse.redirect(
        new URL("/settings?gsc=error&reason=no_sites", process.env.NEXT_PUBLIC_APP_URL ?? "/")
      );
    }

    const { error: credError } = await sb.from("search_console_credentials").upsert(
      {
        owner_id: ownerId,
        site_url: sites[0].siteUrl,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: tokens.expiresAt,
      },
      { onConflict: "owner_id,site_url" }
    );
    if (credError) throw credError;

    for (const site of sites) {
      const { error } = await sb.from("search_console_sites").upsert(
        { owner_id: ownerId, site_url: site.siteUrl, name: site.siteUrl.replace(/^sc-domain:/, "") },
        { onConflict: "owner_id,site_url" }
      );
      if (error) throw error;
    }

    logger.info("gsc.oauth connected", { ownerId, sites: sites.length });
  } catch (err) {
    logger.error("gsc.oauth callback failed", { ownerId }, err);
    return NextResponse.redirect(
      new URL("/settings?gsc=error&reason=callback_failed", process.env.NEXT_PUBLIC_APP_URL ?? "/")
    );
  }

  return NextResponse.redirect(
    new URL("/settings?gsc=connected", process.env.NEXT_PUBLIC_APP_URL ?? "/")
  );
}
