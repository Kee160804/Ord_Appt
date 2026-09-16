import { authorizeActiveSuperAdmin } from "@/app/lib/server/admin-authorization";
import {
  isValidUuid,
  requestHasAllowedOrigin,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ agentId: string }>;
}

interface MembershipRow {
  tenant_id: string;
  role_id: string;
}

/**
 * Permanently removes an Auth identity. The profiles foreign key then cascades
 * to the application profile and its memberships, keeping both layers aligned.
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

    const { admin, userId: callerId } = authorization;
    const { agentId: rawAgentId } = await context.params;
    const agentId = decodeURIComponent(rawAgentId).trim();

    if (!isValidUuid(agentId)) {
      return Response.json(
        { error: "A valid account ID is required." },
        { status: 400 },
      );
    }

    if (agentId === callerId) {
      return Response.json(
        { error: "You cannot delete the account you are currently using." },
        { status: 409 },
      );
    }

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, email, platform_role")
      .eq("id", agentId)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return Response.json({ error: "Account not found." }, { status: 404 });
    }

    if (profile.platform_role?.toUpperCase() === "SUPER_ADMIN") {
      const { count, error: adminCountError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true)
        .ilike("platform_role", "SUPER_ADMIN");

      if (adminCountError) {
        throw adminCountError;
      }

      if ((count ?? 0) <= 1) {
        return Response.json(
          {
            error: "The platform's only active super admin cannot be deleted.",
          },
          { status: 409 },
        );
      }
    }

    const { data: memberships, error: membershipsError } = await admin
      .from("tenant_memberships")
      .select("tenant_id, role_id")
      .eq("profile_id", agentId)
      .eq("is_active", true);

    if (membershipsError) {
      throw membershipsError;
    }

    const membershipRows = (memberships ?? []) as MembershipRow[];
    const roleIds = [...new Set(membershipRows.map((row) => row.role_id))];

    if (roleIds.length > 0) {
      const { data: roles, error: rolesError } = await admin
        .from("roles")
        .select("id, tenant_id, name")
        .in("id", roleIds);

      if (rolesError) {
        throw rolesError;
      }

      const ownerTenantIds = new Set(
        (roles ?? [])
          .filter((role) => role.name?.trim().toUpperCase() === "OWNER")
          .map((role) => role.tenant_id as string),
      );

      const orphanedBusinessNames: string[] = [];

      for (const tenantId of ownerTenantIds) {
        const { data: ownerRole, error: ownerRoleError } = await admin
          .from("roles")
          .select("id")
          .eq("tenant_id", tenantId)
          .ilike("name", "OWNER")
          .maybeSingle();

        if (ownerRoleError) {
          throw ownerRoleError;
        }

        if (!ownerRole) {
          continue;
        }

        const { count: ownerCount, error: ownerCountError } = await admin
          .from("tenant_memberships")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("role_id", ownerRole.id)
          .eq("is_active", true);

        if (ownerCountError) {
          throw ownerCountError;
        }

        if ((ownerCount ?? 0) <= 1) {
          const { data: tenant } = await admin
            .from("tenants")
            .select("business_name")
            .eq("id", tenantId)
            .maybeSingle();

          orphanedBusinessNames.push(tenant?.business_name ?? tenantId);
        }
      }

      if (orphanedBusinessNames.length > 0) {
        return Response.json(
          {
            error: `Transfer ownership or delete these businesses first: ${orphanedBusinessNames.join(", ")}.`,
          },
          { status: 409 },
        );
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(agentId);

    if (deleteError) {
      throw deleteError;
    }

    // Defensive cleanup for databases where the auth/profile cascade was not
    // installed correctly. This is harmless when the profile already vanished.
    const { error: staleProfileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", agentId);

    if (staleProfileError) {
      throw staleProfileError;
    }

    return Response.json({
      success: true,
      deletedAccount: {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
      },
    });
  } catch (error) {
    return safeServerError(
      "admin-agent-delete",
      error,
      "Unable to delete this account. No further action was taken.",
    );
  }
}
