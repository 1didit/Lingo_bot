import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

/**
 * Single Supabase client for the whole app (server-side, service-role key).
 *
 * Lazily initialised: the skeleton can boot and answer /start without Supabase
 * configured. The client is only built the first time the DB is actually used,
 * and throws a clear error if the env vars are missing.
 */
let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in .env before using the database.",
    );
  }

  client = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
