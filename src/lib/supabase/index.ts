/**
 * Supabase — barrel export of client factories and helpers.
 */

export { createServerClient } from "@/lib/supabase/server";
export { createClient as createBrowserClient } from "@/lib/supabase/client";
export { createServiceRoleClient } from "@/lib/supabase/service-role";
export { ensureProfile, checkDbHealth } from "@/lib/supabase/init";
export type { DbHealth } from "@/lib/supabase/init";
