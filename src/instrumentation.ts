/**
 * Startup validation — fail fast on invalid configuration.
 * Runs once when the Next.js server instance bootstraps.
 * During `next build` (static generation) the server also bootstraps with
 * NODE_ENV=production but may not have env vars loaded yet, so we only throw
 * when actually serving (NEXT_PHASE = phase-production-server / dev server).
 */

import { serverEnvStatus } from "@/lib/env";
import { logger } from "@/lib/log/logger";

const BUILD_PHASE = "phase-production-build";

export async function register(): Promise<void> {
  const status = serverEnvStatus();
  const phase = process.env.NEXT_PHASE;
  const building = phase === BUILD_PHASE;

  if (!status.ok) {
    const lines = [
      ...status.missing.map((k) => `  • ${k} — missing`),
      ...status.invalid.map((i) => `  • ${i.key} — ${i.message}`),
    ];
    logger.error(`Invalid server environment detected:\n${lines.join("\n")}`);

    if (!building) {
      throw new Error("Invalid server environment. See logs above.");
    }
    return;
  }

  logger.info("Environment validation passed", {
    ai: status.env.AI_PROVIDER ?? "auto",
    resend: Boolean(status.env.RESEND_API_KEY),
    appUrl: status.env.NEXT_PUBLIC_APP_URL,
  });
}
