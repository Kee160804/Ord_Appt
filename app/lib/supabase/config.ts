export function getSupabaseConfig() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key =
    (
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      ""
    ).trim();

  return { url, key };
}

export const missingSupabaseConfigMessage =
  "Authentication is not configured for this deployment. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to this environment, then redeploy.";

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseConfig();
  return url.length > 0 && key.length > 0;
}

export function isDemoModeEnabled() {
  return (
    process.env.NEXT_PUBLIC_ENABLE_DEMO_MODE === "true" ||
    (process.env.NODE_ENV !== "production" && !isSupabaseConfigured())
  );
}
