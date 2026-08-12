/**
 * Déclenche les crons Growth Engine pour SEO / contenu / nurture.
 * Usage: node scripts/trigger-growth-crons.mjs
 * Avec secret Vercel: npx vercel env run --environment production -- node scripts/trigger-growth-crons.mjs
 */
const BASE = "https://revuvia-growth-engine.vercel.app";

const ROUTES = [
  { path: "/api/gsc/sync", method: "POST", label: "GSC sync" },
  { path: "/api/acquisition/seo-intelligence", method: "POST", label: "SEO intelligence" },
  { path: "/api/ops/execute", method: "POST", label: "SEO loop" },
  { path: "/api/ops/publish", method: "POST", label: "Publish queue" },
  { path: "/api/acquisition/nurture", method: "POST", label: "Nurture" },
  { path: "/api/acquisition/briefing", method: "POST", label: "Briefing" },
];

async function main() {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    console.error("CRON_SECRET manquant — utilisez npx vercel env run --environment production -- node scripts/trigger-growth-crons.mjs");
    process.exit(1);
  }

  console.log("\n=== Growth Engine cron triggers ===\n");

  for (const route of ROUTES) {
    try {
      const res = await fetch(`${BASE}${route.path}`, {
        method: route.method,
        headers: { Authorization: `Bearer ${secret}` },
      });
      const text = await res.text();
      console.log(`${res.ok ? "✓" : "✗"} ${route.label} (${res.status}): ${text.slice(0, 180)}`);
    } catch (err) {
      console.log(`✗ ${route.label}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main();
