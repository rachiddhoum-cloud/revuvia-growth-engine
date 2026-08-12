/**
 * Lien signé one-shot pour /api/public/gsc-connect (sans session ops).
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { resolveOwnerId } from "@/lib/owner";

export const GSC_CONNECT_LINK_TTL_MS = 24 * 60 * 60 * 1000;

interface ConnectLinkPayload {
  ownerId: string;
  exp: number;
}

function readSecret(): string {
  return (
    process.env.GSC_CONNECT_LINK_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.OAUTH_STATE_SECRET?.trim() ||
    ""
  );
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

/** Token URL-safe : base64url(payload).base64url(hmac) */
export function buildGscConnectToken(ownerIdInput?: string, now = Date.now()): string | null {
  const secret = readSecret();
  if (!secret) return null;

  const ownerId = resolveOwnerId(ownerIdInput);
  const payload: ConnectLinkPayload = { ownerId, exp: now + GSC_CONNECT_LINK_TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

export function verifyGscConnectToken(
  token: string | null,
  now = Date.now()
): { ok: true; ownerId: string } | { ok: false; reason: string } {
  if (!token?.trim()) return { ok: false, reason: "missing_token" };

  const secret = readSecret();
  if (!secret) return { ok: false, reason: "secret_unconfigured" };

  const parts = token.trim().split(".");
  if (parts.length !== 2) return { ok: false, reason: "invalid_format" };

  const [payloadB64, signature] = parts;
  const expected = Buffer.from(sign(payloadB64, secret), "base64url");
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return { ok: false, reason: "invalid_signature" };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as ConnectLinkPayload;
    if (typeof payload.ownerId !== "string" || typeof payload.exp !== "number") {
      return { ok: false, reason: "invalid_payload" };
    }
    if (now > payload.exp) return { ok: false, reason: "expired" };
    return { ok: true, ownerId: payload.ownerId };
  } catch {
    return { ok: false, reason: "invalid_payload" };
  }
}
