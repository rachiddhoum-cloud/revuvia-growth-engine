/**
 * Resend client factory.
 * Returns a singleton client; throws a clear error when the key is missing.
 */

import { Resend } from "resend";

let client: Resend | null = null;

export function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!client) {
    client = new Resend(process.env.RESEND_API_KEY);
  }
  return client;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function defaultFrom(): string {
  return process.env.RESEND_FROM ?? "Revuvia Growth Engine <onboarding@revuvia.com>";
}
