import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export async function authorizeBillingOwner(tenantId: string) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      authorized: false as const,
      response: Response.json(
        { error: "Billing is not configured." },
        { status: 503 },
      ),
    };
  }
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    return {
      authorized: false as const,
      response: Response.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("roles(name)")
    .eq("tenant_id", tenantId)
    .eq("profile_id", authData.user.id)
    .eq("is_active", true)
    .maybeSingle();
  const roles = membership?.roles as unknown as
    { name?: string } | Array<{ name?: string }> | null;
  const role = Array.isArray(roles) ? roles[0]?.name : roles?.name;
  if (role?.toUpperCase() !== "OWNER") {
    return {
      authorized: false as const,
      response: Response.json(
        { error: "Only the business owner can manage subscriptions." },
        { status: 403 },
      ),
    };
  }
  return {
    authorized: true as const,
    user: authData.user,
    admin: getSupabaseAdminClient(),
  };
}
