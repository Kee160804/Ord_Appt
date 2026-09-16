import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

type AdminAuthorizationResult =
  | {
      authorized: true;
      admin: ReturnType<typeof getSupabaseAdminClient>;
      userId: string;
    }
  | {
      authorized: false;
      response: Response;
    };

/**
 * Authenticates privileged admin API calls before exposing the service-role
 * client. The service role bypasses RLS, so every caller must pass this check.
 */
export async function authorizeActiveSuperAdmin(
  forbiddenMessage = "Only an active platform super admin can perform this action.",
): Promise<AdminAuthorizationResult> {
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    return {
      authorized: false,
      response: Response.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      ),
    };
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) {
    return {
      authorized: false,
      response: Response.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const admin = getSupabaseAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, platform_role, is_active")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (
    profile?.is_active !== true ||
    profile.platform_role?.toUpperCase() !== "SUPER_ADMIN"
  ) {
    return {
      authorized: false,
      response: Response.json({ error: forbiddenMessage }, { status: 403 }),
    };
  }

  return {
    authorized: true,
    admin,
    userId: authData.user.id,
  };
}
