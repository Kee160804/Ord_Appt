import { authCallbackUrl } from "@/app/lib/platform";
import { authorizeActiveSuperAdmin } from "@/app/lib/server/admin-authorization";
import {
  generateSecurePassword,
  isValidEmail,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Platform roles are global; every other role requires a tenant. */
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

/** Creates or assigns an agent after server-side Super Admin authorization. */
export async function POST(request: Request) {
  try {
    const authorization = await authorizeActiveSuperAdmin(
      "Only an active platform super admin can manage agents.",
    );
    if (!authorization.authorized) return authorization.response;

    const { admin, userId: callerId } = authorization;

    let body: CreateAgentRequest;

    try {
      body = (await request.json()) as CreateAgentRequest;
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();

    // Authorization values are explicit; invalid roles never default to STAFF.
    const requestedRole =
      typeof body.role === "string" ? body.role.trim().toLowerCase() : "";

    // "platform" is a scope marker, not a tenant ID.
    const tenantId =
      typeof body.tenantId === "string" &&
      body.tenantId.trim() !== "" &&
      body.tenantId.trim().toLowerCase() !== "platform"
        ? body.tenantId.trim()
        : null;

    const sendPasswordEmail = body.sendPasswordEmail !== false;

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

    // Client JSON is untrusted, so enforce the runtime role allow-list.
    if (!ALLOWED_ROLES.includes(requestedRole as AgentRole)) {
      return Response.json({ error: "Invalid agent role." }, { status: 400 });
    }

    const role = requestedRole as AgentRole;

    // Missing tenant data must never elevate a tenant role to Super Admin.
    const isSuperAdmin = role === "superadmin";

    if (!isSuperAdmin && !tenantId) {
      return Response.json(
        {
          error:
            "A business tenant is required for owner, admin, manager, and staff accounts.",
        },
        { status: 400 },
      );
    }

    if (isSuperAdmin && tenantId) {
      return Response.json(
        {
          error:
            "Platform super admins cannot be created with a tenant assignment.",
        },
        { status: 400 },
      );
    }

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

    const password =
      body.password && body.password.length >= 12
        ? body.password
        : generateSecurePassword();

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
      // Reuse an existing identity without rotating credentials it owns.
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

    const { data: existingUserProfile, error: userProfileError } = await admin
      .from("profiles")
      .select("id, platform_role")
      .eq("id", userId)
      .maybeSingle();

    if (userProfileError) {
      throw userProfileError;
    }

    // Adding tenant membership must not demote an existing Super Admin.
    const existingPlatformRole =
      existingUserProfile?.platform_role?.toUpperCase() || null;

    const platformRole = isSuperAdmin
      ? "SUPER_ADMIN"
      : existingPlatformRole === "SUPER_ADMIN"
        ? "SUPER_ADMIN"
        : null;

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

    let assignedRoleName = isSuperAdmin ? "Super Admin" : role.toUpperCase();

    if (tenantId) {
      const dbRoleName = role.toUpperCase();

      let roleId: string;

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
        // Account creation remains valid when optional email delivery fails.
        console.warn(
          "Could not dispatch password reset email to agent:",
          emailError,
        );
      }
    }

    try {
      await admin.from("team_access_events").insert({
        tenant_id: tenantId,
        actor_id: callerId,
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
      // Preserve a successful account operation when optional auditing fails.
      console.warn("Could not record agent audit event:", auditError);
    }

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
