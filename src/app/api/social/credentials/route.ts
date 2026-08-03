import { NextResponse } from "next/server";

import { withRouteHandler } from "@/lib/http";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { resolveOwnerId } from "@/lib/owner";
import { logger } from "@/lib/log/logger";

interface CredentialsBody {
  ownerId?: unknown;
  platform?: unknown;
  accessToken?: unknown;
  accountId?: unknown;
  accountName?: unknown;
}

const PLATFORMS = ["linkedin", "facebook", "x"] as const;

function isPlatform(value: unknown): value is (typeof PLATFORMS)[number] {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

function ownerOf(body: CredentialsBody): string {
  return resolveOwnerId(typeof body?.ownerId === "string" ? body.ownerId : null);
}

/** GET /api/social/credentials?ownerId=... — connection state per platform. */
export const dynamic = "force-dynamic";
export async function GET(request: Request): Promise<NextResponse> {
  const ownerId = resolveOwnerId(new URL(request.url).searchParams.get("ownerId"));
  const sb = createServiceRoleClient();
  const { data } = await sb
    .from("social_credentials")
    .select("platform,account_name")
    .eq("owner_id", ownerId);
  const names = new Map((data ?? []).map((c) => [c.platform, c.account_name]));
  const platforms: Record<string, { connected: boolean; accountName: string | null }> = {};
  for (const platform of PLATFORMS) {
    platforms[platform] = {
      connected: names.has(platform),
      accountName: names.get(platform) ?? null,
    };
  }
  return NextResponse.json({ platforms });
}

/** POST /api/social/credentials — upsert a platform credential (token paste). */
export const POST = withRouteHandler<CredentialsBody>(
  async (body) => {
    if (!isPlatform(body?.platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }
    if (typeof body?.accessToken !== "string" || body.accessToken.trim().length < 10) {
      return NextResponse.json({ error: "accessToken must be a non-empty string" }, { status: 400 });
    }
    const ownerId = ownerOf(body);
    const sb = createServiceRoleClient();

    const { error } = await sb.from("social_credentials").upsert(
      {
        owner_id: ownerId,
        platform: body.platform,
        access_token: body.accessToken.trim(),
        account_id: typeof body.accountId === "string" && body.accountId.trim() ? body.accountId.trim() : null,
        account_name: typeof body.accountName === "string" && body.accountName.trim() ? body.accountName.trim() : null,
      },
      { onConflict: "owner_id,platform" }
    );
    if (error) throw new Error(`Failed to save credential: ${error.message}`);

    logger.info("social.credentials upserted", { ownerId, platform: body.platform });
    return NextResponse.json({ ok: true });
  }
);

/** DELETE /api/social/credentials — remove a platform credential. */
export const DELETE = withRouteHandler<CredentialsBody>(
  async (body) => {
    if (!isPlatform(body?.platform)) {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }
    const ownerId = ownerOf(body);
    const sb = createServiceRoleClient();
    const { error } = await sb
      .from("social_credentials")
      .delete()
      .eq("owner_id", ownerId)
      .eq("platform", body.platform);
    if (error) throw new Error(`Failed to delete credential: ${error.message}`);
    return NextResponse.json({ ok: true });
  }
);
