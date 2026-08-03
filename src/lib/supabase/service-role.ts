import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

let cachedClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

/**
 * Service-role client — server only. Escapes RLS.
 * Never import from client components.
 */
export function createServiceRoleClient() {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  cachedClient = createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}
