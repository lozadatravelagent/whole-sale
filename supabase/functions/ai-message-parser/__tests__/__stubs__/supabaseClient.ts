// Vitest stub for `jsr:@supabase/supabase-js@2`.
// Returns a no-op client. We never invoke `serve()` in tests, so the client
// is never used at runtime — it only needs to type-resolve at import time.
export type SupabaseClient = Record<string, unknown>;

export function createClient(_url: string, _key: string): SupabaseClient {
  return {};
}
