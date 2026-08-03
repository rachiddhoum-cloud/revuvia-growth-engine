/**
 * Public (browser-safe) environment accessor.
 * NEXT_PUBLIC_* variables are inlined at build time by Next.js.
 * Must not throw and must not import server-only modules.
 */

export interface PublicEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
}

const DEFAULT_APP_URL = "http://localhost:3000";

/** Returns public environment values (never throws). */
export function getPublicEnv(): PublicEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL,
  };
}
