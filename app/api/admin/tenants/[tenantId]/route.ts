import { authorizeActiveSuperAdmin } from "@/app/lib/server/admin-authorization";
import {
  isValidUuid,
  requestHasAllowedOrigin,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ tenantId: string }>;
}

/**
 * Permanently deletes a tenant and all tenant-scoped records that are protected
 * by ON DELETE CASCADE. Accounts are removed only when the deleted tenant was
 * their final membership, preserving the multi-business account hierarchy.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    if (!requestHasAllowedOrigin(request)) {
      return Response.json(
        { error: "Invalid request origin." },
        { status: 403 },
      );
    }

    const authorization = await authorizeActiveSuperAdmin();

    if (!authorization.authorized) {
      return authorization.response;
    }

    const { admin } = authorization;
    const { tenantId: rawTenantId } = await context.params;
    const tenantId = decodeURIComponent(rawTenantId).trim();

    if (!isValidUuid(tenantId)) {
      return Response.json(
        { error: "A valid tenant ID is required." },
        { status: 400 },
      );
    }

    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .select("id, business_name")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError) {
      throw tenantError;
    }

    if (!tenant) {
      return Response.json({ error: "Tenant not found." }, { status: 404 });
    }

    const { data: memberships, error: membershipError } = await admin
      .from("tenant_memberships")
      .select("profile_id")
      .eq("tenant_id", tenantId);

    if (membershipError) {
      throw membershipError;
    }

    const affectedProfileIds = [
      ...new Set(
        (memberships ?? [])
          .map((membership) => membership.profile_id as string)
          .filter(Boolean),
      ),
    ];

    // The database function removes restrictive role references first and then
    // cascades all remaining tenant data in one transaction.
    const { error: deleteError } = await admin.rpc("delete_platform_tenant", {
      p_tenant_id: tenantId,
    });

    if (deleteError) {
      throw deleteError;
    }

    const removedAccountIds: string[] = [];
    const retainedAccountIds: string[] = [];
    const cleanupWarnings: string[] = [];

    for (const profileId of affectedProfileIds) {
      const { count, error: remainingMembershipError } = await admin
        .from("tenant_memberships")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profileId);

      if (remainingMembershipError) {
        cleanupWarnings.push(
          `Could not verify remaining businesses for account ${profileId}.`,
        );
        continue;
      }

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("platform_role")
        .eq("id", profileId)
        .maybeSingle();

      if (profileError) {
        cleanupWarnings.push(`Could not inspect account ${profileId}.`);
        continue;
      }

      const isPlatformAdmin =
        profile?.platform_role?.toUpperCase() === "SUPER_ADMIN";

      if ((count ?? 0) > 0 || isPlatformAdmin) {
        retainedAccountIds.push(profileId);
        continue;
      }

      const { error: authDeleteError } =
        await admin.auth.admin.deleteUser(profileId);

      if (authDeleteError) {
        cleanupWarnings.push(
          `The tenant was deleted, but orphaned account ${profileId} could not be removed.`,
        );
        continue;
      }

      removedAccountIds.push(profileId);
    }

    return Response.json({
      success: true,
      deletedTenant: {
        id: tenant.id,
        name: tenant.business_name,
      },
      removedAccountIds,
      retainedAccountIds,
      cleanupWarnings,
    });
  } catch (error) {
    return safeServerError(
      "admin-tenant-delete",
      error,
      "Unable to delete this tenant. No further action was taken.",
    );
  }
}
