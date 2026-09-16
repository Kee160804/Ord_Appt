import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import { authCallbackUrl } from "@/app/lib/platform";
import {
  generateSecurePassword,
  isValidEmail,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Roles that can be created through Agent Management.
 *
 * IMPORTANT:
 * - SUPERADMIN is a platform-level role.
 * - OWNER/ADMIN/MANAGER/STAFF are tenant-level roles.
 * - Tenant-level roles MUST always have a valid tenantId.
 */
type AgentRole = "superadmin" | "owner" | "admin" | "manager" | "staff";

interface CreateAgentRequest {
  name: string;
  email: string;
  role: AgentRole;
  tenantId?: string | null;
  password?: string;
  sendPasswordEmail?: boolean;
}

const ALLOWED_ROLES: AgentRole[] = [
  "superadmin",
  "owner",
  "admin",
  "manager",
  "staff",
];

/**
 * POST /api/admin/agents
 *
 * Creates or assigns an agent.
 *
 * SECURITY:
 * Only an authenticated, active platform SUPER_ADMIN can call
 * this endpoint.
 */
export async function POST(request: Request) {
  try {
    /* ================================================================
       1. VERIFY AUTHENTICATED SESSION
       ================================================================ */

    const supabase = await getSupabaseServerClient();

    if (!supabase) {
      return Response.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      );
    }

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    /*
     * The service-role/admin client bypasses RLS.
     *
     * Therefore authorization MUST be completed before performing
     * privileged database operations with this client.
     */
    const admin = getSupabaseAdminClient();

    /* ================================================================
       2. VERIFY CALLER IS AN ACTIVE PLATFORM SUPER ADMIN
       ================================================================ */

    const { data: callerProfile, error: callerProfileError } = await admin
      .from("profiles")
      .select("id, platform_role, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (callerProfileError) {
      throw callerProfileError;
    }

    const callerIsSuperAdmin =
      callerProfile?.is_active === true &&
      callerProfile.platform_role?.toUpperCase() === "SUPER_ADMIN";

    if (!callerIsSuperAdmin) {
      return Response.json(
        {
          error: "Only an active platform super admin can manage agents.",
        },
        { status: 403 },
      );
    }

    /* ================================================================
       3. PARSE AND NORMALIZE REQUEST
       ================================================================ */

    let body: CreateAgentRequest;

    try {
      body = (await request.json()) as CreateAgentRequest;
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();

    /*
     * Do NOT silently default invalid/missing roles to STAFF.
     *
     * Authorization-related values should always be explicit.
     */
    const requestedRole =
      typeof body.role === "string" ? body.role.trim().toLowerCase() : "";

    /*
     * Normalize empty tenant IDs to null.
     *
     * "platform" is NOT treated as a tenant ID.
     * Platform access is determined explicitly by role === superadmin.
     */
    const tenantId =
      typeof body.tenantId === "string" &&
      body.tenantId.trim() !== "" &&
      body.tenantId.trim().toLowerCase() !== "platform"
        ? body.tenantId.trim()
        : null;

    const sendPasswordEmail = body.sendPasswordEmail !== false;

    /* ================================================================
       4. VALIDATE BASIC INPUT
       ================================================================ */

    if (!name || name.length < 2) {
      return Response.json(
        { error: "Agent full name is required." },
        { status: 400 },
      );
    }

    if (!email || !isValidEmail(email)) {
      return Response.json(
        { error: "A valid email address is required." },
        { status: 400 },
      );
    }

    /*
     * Explicitly allow-list roles.
     *
     * Never trust the TypeScript interface as runtime validation,
     * because clients can send arbitrary JSON.
     */
    if (!ALLOWED_ROLES.includes(requestedRole as AgentRole)) {
      return Response.json({ error: "Invalid agent role." }, { status: 400 });
    }

    const role = requestedRole as AgentRole;

    /* ================================================================
       5. CRITICAL ROLE / TENANT AUTHORIZATION RULES
       ================================================================ */

    /**
     * CRITICAL SECURITY FIX
     *
     * OLD:
     *
     * const isSuperAdmin = role === "superadmin" || !tenantId;
     *
     * That meant:
     *
     * role = "staff"
     * tenantId = null
     *
     * could result in SUPER_ADMIN privileges.
     *
     * Super-admin status must ONLY come from an explicit
     * superadmin role request.
     */
    const isSuperAdmin = role === "superadmin";

    /**
     * Tenant-facing roles MUST have a tenant.
     *
     * Missing tenant IDs now produce a 400 response instead of
     * silently creating a SUPER_ADMIN.
     */
    if (!isSuperAdmin && !tenantId) {
      return Response.json(
        {
          error:
            "A business tenant is required for owner, admin, manager, and staff accounts.",
        },
        { status: 400 },
      );
    }

    /**
     * A SUPER_ADMIN is platform-scoped and should not be created
     * with a tenant assignment through this endpoint.
     */
    if (isSuperAdmin && tenantId) {
      return Response.json(
        {
          error:
            "Platform super admins cannot be created with a tenant assignment.",
        },
        { status: 400 },
      );
    }

    /* ================================================================
       6. VERIFY TENANT
       ================================================================ */

    let tenantName = "Platform";

    if (tenantId) {
      const { data: tenantRow, error: tenantQueryError } = await admin
        .from("tenants")
        .select("id, business_name")
        .eq("id", tenantId)
        .maybeSingle();

      if (tenantQueryError) {
        throw tenantQueryError;
      }

      if (!tenantRow) {
        return Response.json(
          { error: "Selected business tenant not found." },
          { status: 400 },
        );
      }

      tenantName = tenantRow.business_name;
    }

    /* ================================================================
       7. GENERATE / VALIDATE INITIAL PASSWORD
       ================================================================ */

    const password =
      body.password && body.password.length >= 12
        ? body.password
        : generateSecurePassword();

    /* ================================================================
       8. CREATE OR FIND AUTH USER
       ================================================================ */

    let userId: string;
    let createdNewUser = false;

    const { data: createdAuth, error: createAuthError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
        },
      });

    if (createAuthError) {
      /*
       * The email may already belong to an existing account.
       *
       * Do NOT reset/rotate an existing user's password here.
       * We only reuse the existing profile ID.
       */
      const { data: existingProfile, error: existingProfileError } = await admin
        .from("profiles")
        .select("id, platform_role")
        .eq("email", email)
        .maybeSingle();

      if (existingProfileError) {
        throw existingProfileError;
      }

      if (!existingProfile) {
        return Response.json(
          {
            error: createAuthError.message || "Failed to create agent user.",
          },
          { status: 400 },
        );
      }

      userId = existingProfile.id;
    } else {
      if (!createdAuth.user) {
        throw new Error("Supabase did not return the newly created user.");
      }

      userId = createdAuth.user.id;
      createdNewUser = true;
    }

    /* ================================================================
       9. CHECK EXISTING PROFILE PRIVILEGES
       ================================================================ */

    const { data: existingUserProfile, error: userProfileError } = await admin
      .from("profiles")
      .select("id, platform_role")
      .eq("id", userId)
      .maybeSingle();

    if (userProfileError) {
      throw userProfileError;
    }

    /**
     * Important:
     *
     * If an existing SUPER_ADMIN is assigned tenant membership,
     * we should NOT accidentally remove their platform role by
     * writing platform_role: null.
     */
    const existingPlatformRole =
      existingUserProfile?.platform_role?.toUpperCase() || null;

    const platformRole = isSuperAdmin
      ? "SUPER_ADMIN"
      : existingPlatformRole === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : null;

    /* ================================================================
       10. UPSERT PROFILE
       ================================================================ */

    const { error: profileUpsertError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: name,
      platform_role: platformRole,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (profileUpsertError) {
      throw profileUpsertError;
    }

    /* ================================================================
       11. ASSIGN TENANT ROLE + MEMBERSHIP
       ================================================================ */

    let assignedRoleName = isSuperAdmin ? "Super Admin" : role.toUpperCase();

    if (tenantId) {
      const dbRoleName = role.toUpperCase();

      let roleId: string;

      /*
       * Look for an existing tenant role first.
       */
      const { data: existingRole, error: existingRoleError } = await admin
        .from("roles")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .ilike("name", dbRoleName)
        .maybeSingle();

      if (existingRoleError) {
        throw existingRoleError;
      }

      if (existingRole) {
        roleId = existingRole.id;
        assignedRoleName = existingRole.name;
      } else {
        /*
         * Preserve your existing behavior:
         * create the role if this tenant does not have it.
         */
        const { data: insertedRole, error: roleInsertError } = await admin
          .from("roles")
          .insert({
            tenant_id: tenantId,
            name: dbRoleName,
            description: `${dbRoleName} role`,
            is_system_role: dbRoleName === "OWNER",
          })
          .select("id, name")
          .single();

        if (roleInsertError) {
          throw roleInsertError;
        }

        roleId = insertedRole.id;
        assignedRoleName = insertedRole.name;
      }

      /*
       * Create/update membership for this specific tenant.
       */
      const { error: membershipError } = await admin
        .from("tenant_memberships")
        .upsert({
          tenant_id: tenantId,
          profile_id: userId,
          role_id: roleId,
          is_active: true,
        });

      if (membershipError) {
        throw membershipError;
      }
    }

    /* ================================================================
       12. SEND PASSWORD SETUP / RESET EMAIL
       ================================================================ */

    let emailSent = false;

    const redirectTo = authCallbackUrl(
      "/reset-password",
      new URL(request.url).origin,
    );

    if (sendPasswordEmail) {
      try {
        const { error: resetEmailError } =
          await admin.auth.resetPasswordForEmail(email, {
            redirectTo,
          });

        if (!resetEmailError) {
          emailSent = true;
        } else {
          console.warn(
            "Password reset email was not sent:",
            resetEmailError.message,
          );
        }
      } catch (emailError) {
        /*
         * Agent creation should remain successful even if email
         * delivery temporarily fails.
         */
        console.warn(
          "Could not dispatch password reset email to agent:",
          emailError,
        );
      }
    }

    /* ================================================================
       13. RECORD AUDIT EVENT
       ================================================================ */

    try {
      await admin.from("team_access_events").insert({
        tenant_id: tenantId,
        actor_id: authData.user.id,
        action: "AGENT_CREATED",
        details: {
          name,
          email,
          role: assignedRoleName,
          tenantName,
          emailSent,
          createdNewUser,
        },
      });
    } catch (auditError) {
      /*
       * Audit logging is currently best-effort.
       *
       * Do not fail an otherwise successful account creation merely
       * because the optional audit table is unavailable.
       */
      console.warn("Could not record agent audit event:", auditError);
    }

    /* ================================================================
       14. SUCCESS RESPONSE
       ================================================================ */

    return Response.json(
      {
        success: true,

        agent: {
          id: userId,
          name,
          email,
          role: assignedRoleName,
          tenantId,
          tenantName,
          isActive: true,
        },

        emailSent,
        createdNewUser,
      },
      { status: createdNewUser ? 201 : 200 },
    );
  } catch (error) {
    return safeServerError(
      "admin-agent-create",
      error,
      "Unable to create agent. Please try again.",
    );
  }
}
