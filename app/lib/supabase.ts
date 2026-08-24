import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseEnabled() {
  return SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
}

export async function getSupabaseClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseEnabled()) return null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
      },
    });
  } catch (error) {
    console.warn("Supabase client could not be initialized:", error);
    return null;
  }
}

export async function getSupabaseAuth() {
  const client = await getSupabaseClient();
  return client?.auth ?? null;
}
