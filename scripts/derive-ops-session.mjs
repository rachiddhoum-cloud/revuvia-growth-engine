#!/usr/bin/env node
/**
 * Derive OPS_SESSION_TOKEN from OPS_ACCESS_PASSWORD for Vercel env.
 * Usage: OPS_ACCESS_PASSWORD=secret node scripts/derive-ops-session.mjs
 */
import { createHmac } from "node:crypto";

const password = process.env.OPS_ACCESS_PASSWORD?.trim();
if (!password) {
  console.error("Set OPS_ACCESS_PASSWORD to derive OPS_SESSION_TOKEN");
  process.exit(1);
}

const token = createHmac("sha256", password).update("revuvia-growth-engine-ops-v1").digest("hex");
console.log(token);
