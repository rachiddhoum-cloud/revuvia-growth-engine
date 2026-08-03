/**
 * Signed OAuth state — Sprint 6.
 *
 * The OAuth `state` parameter is HMAC-signed so a callback can only be
 * initiated by our own /connect route. `buildOAuthState` produces
 * `payload.signature`; `verifyOAuthState` rejects tampered or expired
 * states. Pure + injectable secret for tests.
 */

import { createHmac, timingSafeEqual } from "crypto";

export interface OAuthStatePayload {
  ownerId: string;
  /** epoch ms — states expire after this. */
  exp: number;
}

export const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function normalizeSecret(secret: string): string {
  const fromEnv = process.env.OAUTH_STATE_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  return secret || fromEnv || "insecure-default-state-secret";
}

/** Encode the signed state: base64url(payload).base64url(hmac). */
export function buildOAuthState(
  ownerId: string,
  secret = "",
  now = Date.now(),
  ttlMs = STATE_TTL_MS
): string {
  const payload: OAuthStatePayload = { ownerId, exp: now + ttlMs };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(payloadB64, normalizeSecret(secret));
  return `${payloadB64}.${signature}`;
}

function sign(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function decode(encoded: string, secret: string): OAuthStatePayload | null {
  const parts = encoded.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expected = Buffer.from(sign(payloadB64, secret), "base64url");
  let actual: Buffer;
  try {
    actual = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as OAuthStatePayload;
    if (typeof parsed.ownerId !== "string" || typeof parsed.exp !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface StateVerification {
  ok: boolean;
  ownerId: string | null;
  reason: "valid" | "tampered" | "expired" | "missing";
}

/** Verify and decode a state value, enforcing expiry. */
export function verifyOAuthState(encoded: string | null, secret = "", now = Date.now()): StateVerification {
  if (!encoded) return { ok: false, ownerId: null, reason: "missing" };
  const payload = decode(encoded, normalizeSecret(secret));
  if (!payload) return { ok: false, ownerId: null, reason: "tampered" };
  if (now > payload.exp) return { ok: false, ownerId: payload.ownerId, reason: "expired" };
  return { ok: true, ownerId: payload.ownerId, reason: "valid" };
}
