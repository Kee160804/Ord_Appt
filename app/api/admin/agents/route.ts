import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import {
  generateSecurePassword,
  isValidEmail,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateAgentRequest {
  name: string;
  email: string;
  role: "superadmin" | "owner" | "admin" | "manager" | "staff";
  tenantId?: string | null;
  password?: string;
  sendPasswordEmail?: boolean;
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) {
      return Response.json(
        { error: "Supabase is not configured." },
        { status: 503 },
      );
    }

    // Verify session
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const admin = getSupabaseAdminClient();

    // Verify caller is super admin
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id, platform_role, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (
      !profile?.is_active ||
      profile.platform_role?.toUpperCase() !== "SUPER_ADMIN"
    ) {
      return Response.json(
        { error: "Only a platform super admin can add agents." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as CreateAgentRequest;
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role?.toLowerCase() || "staff";
    const tenantId =
      body.tenantId && body.tenantId !== "platform" ? body.tenantId : null;
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

    const password =
      body.password && body.password.length >= 12
        ? body.password
        : generateSecurePassword();
    const isSuperAdmin = role === "superadmin" || !tenantId;

    // Verify tenant if assigned
    let tenantName = "Platform";
    if (tenantId) {
      const { data: tenantRow, error: tenantQueryError } = await admin
        .from("tenants")
        .select("id, business_name")
        .eq("id", tenantId)
        .maybeSingle();

      if (tenantQueryError || !tenantRow) {
        return Response.json(
          { error: "Selected business tenant not found." },
          { status: 400 },
        );
      }
      tenantName = tenantRow.business_name;
    }

    // 1. Create or retrieve auth user
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
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();

      if (existingProfile) {
        // Existing credentials belong to that user. Assigning access must never
        // silently rotate their password.
        userId = existingProfile.id;
      } else {
        return Response.json(
          { error: createAuthError.message || "Failed to create agent user." },
          { status: 400 },
        );
      }
    } else {
      userId = createdAuth.user.id;
      createdNewUser = true;
    }

    // 2. Upsert profile
    const { error: profileUpsertError } = await admin.from("profiles").upsert({
      id: userId,
      email,
      full_name: name,
      platform_role: isSuperAdmin ? "SUPER_ADMIN" : null,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (profileUpsertError) throw profileUpsertError;

    // 3. Assign role & membership if tenant-specific agent
    let assignedRoleName = isSuperAdmin ? "Super Admin" : role.toUpperCase();

    if (tenantId) {
      const dbRoleName = role.toUpperCase();
      let roleId: string;

      const { data: existingRole } = await admin
        .from("roles")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .ilike("name", dbRoleName)
        .maybeSingle();

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

        if (roleInsertError) throw roleInsertError;
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

      if (membershipError) throw membershipError;
    }

    // 4. Handle password setup / reset email or recovery link
    let emailSent = false;

    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      "http://localhost:3000";
    const cleanOrigin = origin.replace(/\/+$/, "");
    const redirectTo = `${cleanOrigin}/auth/confirm?next=/reset-password`;

    if (sendPasswordEmail) {
      try {
        const { error: resetEmailError } =
          await admin.auth.resetPasswordForEmail(email, {
            redirectTo,
          });

        if (!resetEmailError) {
          emailSent = true;
        }
      } catch (emailErr) {
        console.warn(
          "Could not dispatch password reset email to agent:",
          emailErr,
        );
      }
    }

    // 5. Record audit event (best effort)
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
        },
      });
    } catch {
      // Ignored if table not installed
    }

    return Response.json({
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
    });
  } catch (error) {
    return safeServerError(
      "admin-agent-create",
      error,
      "Unable to create agent. Please try again.",
    );
  }
}
