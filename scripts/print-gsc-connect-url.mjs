/**
 * Affiche un lien public signé pour connecter GSC sans login ops.
 * Usage: node scripts/print-gsc-connect-url.mjs
 */
import { createHmac } from "node:crypto";
import { listProjectEnv, decryptProjectEnv } from "../../vibe-pwa-main-audit/scripts/lib/vercel-api.mjs";

const GE_PROJECT = "prj_C8CI0RlaAQA8ilsc4evd3cvKeRAw";
const FOUNDER_OWNER_ID = "3588dae8-8c7d-494b-b9d2-9e0a539fa5d9";
const BASE = "https://revuvia-growth-engine.vercel.app";
const TTL_MS = 30 * 60 * 1000;

function sign(payloadB64, secret) {
  return createHmac("sha256", secret).update(payloadB64).digest("base64url");
}

function buildToken(secret, ownerId) {
  const payload = { ownerId, exp: Date.now() + TTL_MS };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

async function readCronSecret() {
  const envs = await listProjectEnv(GE_PROJECT);
  const entry = envs.find((e) => e.key === "CRON_SECRET" && e.target?.includes("production"));
  if (!entry) return process.env.CRON_SECRET?.trim() || null;
  return (await decryptProjectEnv(GE_PROJECT, entry.id)) || process.env.CRON_SECRET?.trim() || null;
}

async function main() {
  const secret = await readCronSecret();
  if (!secret) {
    console.error("CRON_SECRET introuvable — définissez CRON_SECRET en local ou sur Vercel.");
    process.exit(1);
  }

  const token = buildToken(secret, FOUNDER_OWNER_ID);
  const url = `${BASE}/api/public/gsc-connect?token=${encodeURIComponent(token)}`;

  console.log("\n=== Lien GSC (valide 30 min) ===\n");
  console.log(url);
  console.log("\nOuvrez ce lien dans Chrome ou Edge, choisissez rachiddhoum@gmail.com, autorisez Search Console.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
