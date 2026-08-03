import { createHmac } from "node:crypto";

import { safeCompare } from "@/lib/security/compare";
import { OPS_SESSION_COOKIE } from "@/lib/security/ops-session-constants";
const SESSION_SALT = "revuvia-growth-engine-ops-v1";

/** Derive the session cookie value from the ops password (used by setup script). */
export function deriveOpsSessionToken(password: string): string {
  return createHmac("sha256", password).update(SESSION_SALT).digest("hex");
}

export function readOpsSessionToken(): string | null {
  const explicit = process.env.OPS_SESSION_TOKEN?.trim();
  if (explicit) return explicit;

  const password = process.env.OPS_ACCESS_PASSWORD?.trim();
  if (password) return deriveOpsSessionToken(password);

  return null;
}

export function readOpsAccessPassword(): string | null {
  return process.env.OPS_ACCESS_PASSWORD?.trim() || null;
}

export function verifyOpsAccessPassword(password: string): boolean {
  const expected = readOpsAccessPassword();
  if (!expected) {
    return process.env.NODE_ENV !== "production";
  }
  return safeCompare(password, expected);
}

export function isOpsSessionCookie(value: string | undefined | null): boolean {
  const token = readOpsSessionToken();
  if (!token) {
    return process.env.NODE_ENV !== "production";
  }
  if (!value) return false;
  return safeCompare(value, token);
}
