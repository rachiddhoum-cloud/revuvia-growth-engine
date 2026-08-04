/**
 * Server environment validation.
 * Parses and validates ALL server-only environment variables on first access.
 * Fail-fast: throws a descriptive error listing every missing/invalid variable.
 *
 * Do not import this module from client components.
 */

import { z } from "zod";

const providerEnum = z.enum(["openai", "anthropic", "gemini", "auto"]);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid URL")
    .default("http://localhost:3000"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GOOGLE_AI_API_KEY: z.string().min(1).optional(),
  AI_PROVIDER: providerEnum.default("auto"),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM: z.string().email("RESEND_FROM must be a valid email").optional(),
  REPORT_RECIPIENT_EMAIL: z.string().email("REPORT_RECIPIENT_EMAIL must be a valid email").optional(),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters").optional(),
  OPS_ACCESS_PASSWORD: z.string().min(12, "OPS_ACCESS_PASSWORD must be at least 12 characters").optional(),
  OPS_SESSION_TOKEN: z.string().min(32).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  GSC_CLIENT_ID: z.string().min(1).optional(),
  GSC_CLIENT_SECRET: z.string().min(1).optional(),
  GSC_REDIRECT_URI: z.string().url("GSC_REDIRECT_URI must be a valid URL").optional(),
  OAUTH_STATE_SECRET: z.string().min(16, "OAUTH_STATE_SECRET must be at least 16 characters").optional(),
  AHREFS_API_TOKEN: z.string().min(1).optional(),
  AHREFS_TARGET: z.string().min(1).optional(),
  REVUVIA_SITE_URL: z.string().url("REVUVIA_SITE_URL must be a valid URL").optional(),
  BLOG_PUBLISH_WEBHOOK_URL: z.string().url("BLOG_PUBLISH_WEBHOOK_URL must be a valid URL").optional(),
  BLOG_PUBLISH_WEBHOOK_SECRET: z.string().min(16).optional(),
  DEFAULT_OWNER_ID: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export interface EnvValidationResult {
  ok: boolean;
  env: Partial<ServerEnv>;
  missing: string[];
  invalid: Array<{ key: string; message: string }>;
}

function readAll(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    AI_PROVIDER: process.env.AI_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    REPORT_RECIPIENT_EMAIL: process.env.REPORT_RECIPIENT_EMAIL,
    CRON_SECRET: process.env.CRON_SECRET,
    OPS_ACCESS_PASSWORD: process.env.OPS_ACCESS_PASSWORD,
    OPS_SESSION_TOKEN: process.env.OPS_SESSION_TOKEN,
    LOG_LEVEL: process.env.LOG_LEVEL,
    GSC_CLIENT_ID: process.env.GSC_CLIENT_ID,
    GSC_CLIENT_SECRET: process.env.GSC_CLIENT_SECRET,
    GSC_REDIRECT_URI: process.env.GSC_REDIRECT_URI,
    OAUTH_STATE_SECRET: process.env.OAUTH_STATE_SECRET,
    AHREFS_API_TOKEN: process.env.AHREFS_API_TOKEN,
    AHREFS_TARGET: process.env.AHREFS_TARGET,
    REVUVIA_SITE_URL: process.env.REVUVIA_SITE_URL,
    BLOG_PUBLISH_WEBHOOK_URL: process.env.BLOG_PUBLISH_WEBHOOK_URL,
    BLOG_PUBLISH_WEBHOOK_SECRET: process.env.BLOG_PUBLISH_WEBHOOK_SECRET,
    DEFAULT_OWNER_ID: process.env.DEFAULT_OWNER_ID,
  };
}

/** Pure validation — used by tests, health checks and the env singleton. */
export function validateServerEnv(source: Record<string, string | undefined> = readAll()): EnvValidationResult {
  const missing: string[] = [];
  const invalid: Array<{ key: string; message: string }> = [];

  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  for (const key of required) {
    if (!source[key]) missing.push(key);
  }

  const parsed = serverEnvSchema.safeParse(source);

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      if (issue.path.length === 0) continue;
      const key = String(issue.path[0]);
      if (!missing.includes(key)) {
        invalid.push({ key, message: issue.message });
      }
    }
  }

  const env = parsed.success ? parsed.data : ({} as Partial<ServerEnv>);
  return { ok: missing.length === 0 && invalid.length === 0, env, missing, invalid };
}

let cached: ServerEnv | null = null;
let cachedValidation: EnvValidationResult | null = null;

/**
 * Returns the validated server environment.
 * Throws on the first access when configuration is invalid (fail-fast).
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const result = validateServerEnv();
  cachedValidation = result;

  if (!result.ok) {
    const lines = [
      ...result.missing.map((k) => `  • ${k} — missing`),
      ...result.invalid.map((i) => `  • ${i.key} — ${i.message}`),
    ];
    throw new Error(
      `Invalid server environment. Fix these before starting:\n${lines.join("\n")}`
    );
  }

  cached = result.env as ServerEnv;
  return cached;
}

/** Non-throwing status used by startup validation and /api/health. */
export function serverEnvStatus(): EnvValidationResult {
  if (cachedValidation) return cachedValidation;
  cachedValidation = validateServerEnv();
  return cachedValidation;
}

/** Test-only: reset the cached singleton. */
export function resetServerEnvCache(): void {
  cached = null;
  cachedValidation = null;
}
