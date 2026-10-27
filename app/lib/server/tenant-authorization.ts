import { getSupabaseServerClient } from "@/app/lib/supabase/server";

export type TenantManagementRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF";

export async function requireTenantRole(
  tenantId: string,
  allowedRoles: TenantManagementRole[],
) {
  const supabase = await getSupabaseServerClient();
  if (!supabase)
    return { error: "Authentication is unavailable.", status: 503 } as const;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return { error: "Sign in to continue.", status: 401 } as const;
  }

  const { data: role, error: roleError } = await supabase.rpc(
    "current_tenant_role",
    { p_tenant_id: tenantId },
  );
  const normalizedRole = typeof role === "string" ? role.toUpperCase() : "";
  if (
    roleError ||
    !allowedRoles.includes(normalizedRole as TenantManagementRole)
  ) {
    return {
      error: "You do not have permission for this business.",
      status: 403,
    } as const;
  }

  return {
    supabase,
    userId: authData.user.id,
    role: normalizedRole as TenantManagementRole,
  } as const;
}
