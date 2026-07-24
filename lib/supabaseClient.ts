import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: ReturnType<
  typeof createBrowserClient<Database>
> | null = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase browser environment variables. Check .env.local."
    );
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      supabaseUrl,
      supabaseAnonKey
    );
  }

  return browserClient;
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
