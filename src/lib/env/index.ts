/**
 * Environment access — server validation + public (browser) accessor.
 */

export { getServerEnv, serverEnvStatus, validateServerEnv, resetServerEnvCache } from "@/lib/env/server";
export type { ServerEnv, EnvValidationResult } from "@/lib/env/server";

export { getPublicEnv } from "@/lib/env/client";
export type { PublicEnv } from "@/lib/env/client";
