import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import {
  generateSecurePassword,
  isValidEmail,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateTenantRequest {
  businessName: string;
  businessType: "appointment" | "ordering" | "retail";
  ownerName: string;
  ownerEmail: string;
  password?: string;
  city?: string;
  phone?: string;
  slug?: string;
  plan?: "starter" | "pro" | "enterprise";
  subscriptionStatus?: "trial" | "active";
  trialDays?: number;
  sendPasswordEmail?: boolean;
}

function cleanSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
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
        { error: "Only a platform super admin can manually create tenants." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as CreateTenantRequest;
    const businessName = body.businessName?.trim();
    const businessType =
      body.businessType?.toLowerCase() === "ordering"
        ? "ordering"
        : body.businessType?.toLowerCase() === "retail"
          ? "retail"
          : "appointment";
    const ownerName = body.ownerName?.trim();
    const ownerEmail = body.ownerEmail?.trim().toLowerCase();
    const city = body.city?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";
    const plan =
      body.plan === "pro" || body.plan === "enterprise" ? body.plan : "starter";
    const subscriptionStatus =
      body.subscriptionStatus === "active" ? "active" : "trial";
    const trialDays =
      Number.isInteger(body.trialDays) && Number(body.trialDays) > 0
        ? Number(body.trialDays)
        : 14;
    const sendPasswordEmail = body.sendPasswordEmail !== false;

    if (!businessName || businessName.length < 2) {
      return Response.json(
        { error: "Business name must be at least 2 characters." },
        { status: 400 },
      );
    }
    if (!ownerName || ownerName.length < 2) {
      return Response.json(
        { error: "Owner full name is required." },
        { status: 400 },
      );
    }
    if (!ownerEmail || !isValidEmail(ownerEmail)) {
      return Response.json(
        { error: "A valid owner email address is required." },
        { status: 400 },
      );
    }

    const password =
      body.password && body.password.length >= 12
        ? body.password
        : generateSecurePassword();

    // Determine unique slug
    let baseSlug = cleanSlug(body.slug || businessName);
    if (!baseSlug) baseSlug = `business-${Date.now().toString().slice(-6)}`;

    let finalSlug = baseSlug;
    const { data: existingSlugs } = await admin
      .from("tenants")
      .select("slug")
      .ilike("slug", `${baseSlug}%`);

    if (existingSlugs && existingSlugs.length > 0) {
      const slugSet = new Set(
        existingSlugs.map((row) => (row.slug as string).toLowerCase()),
      );
      if (slugSet.has(finalSlug.toLowerCase())) {
        let counter = 2;
        while (slugSet.has(`${baseSlug}-${counter}`.toLowerCase())) {
          counter += 1;
        }
        finalSlug = `${baseSlug}-${counter}`;
      }
    }

    // 1. Create or retrieve auth user
    let userId: string;
    let createdNewUser = false;
    const { data: createdAuth, error: createAuthError } =
      await admin.auth.admin.createUser({
        email: ownerEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: ownerName,
          business_name: businessName,
          business_type: businessType,
          business_city: city,
          business_phone: phone,
          business_slug: finalSlug,
        },
      });

    if (createAuthError) {
      // If user already exists in auth.users, fetch their profile or update password
      const { data: existingProfile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", ownerEmail)
        .maybeSingle();

      if (existingProfile) {
        // Reuse the identity without modifying credentials owned by the user.
        userId = existingProfile.id;
      } else {
        return Response.json(
          {
            error: createAuthError.message || "Failed to create user account.",
          },
          { status: 400 },
        );
      }
    } else {
      userId = createdAuth.user.id;
      createdNewUser = true;
    }

    // 2. Ensure profile exists in public.profiles
    const { error: profileUpsertError } = await admin.from("profiles").upsert({
      id: userId,
      email: ownerEmail,
      full_name: ownerName,
      is_active: true,
      updated_at: new Date().toISOString(),
    });

    if (profileUpsertError) throw profileUpsertError;

    // 3. Create tenant
    const trialEndsAt =
      subscriptionStatus === "trial"
        ? new Date(Date.now() + trialDays * 86_400_000).toISOString()
        : null;

    const { data: newTenant, error: tenantInsertError } = await admin
      .from("tenants")
      .insert({
        business_name: businessName,
        slug: finalSlug,
        subdomain: finalSlug,
        business_type: businessType,
        city,
        phone,
        email: ownerEmail,
        created_by: userId,
        status: "ACTIVE",
        is_active: true,
        plan,
        subscription_status: subscriptionStatus,
        trial_ends_at: trialEndsAt,
      })
      .select(
        "id, business_name, slug, business_type, plan, subscription_status, trial_ends_at",
      )
      .single();

    if (tenantInsertError) throw tenantInsertError;

    // 4. Ensure OWNER role exists for this tenant
    let roleId: string;
    const { data: existingRole } = await admin
      .from("roles")
      .select("id")
      .eq("tenant_id", newTenant.id)
      .ilike("name", "OWNER")
      .maybeSingle();

    if (existingRole) {
      roleId = existingRole.id;
    } else {
      const { data: insertedRole, error: roleInsertError } = await admin
        .from("roles")
        .insert({
          tenant_id: newTenant.id,
          name: "OWNER",
          description: "Business owner",
          is_system_role: true,
        })
        .select("id")
        .single();

      if (roleInsertError) throw roleInsertError;
      roleId = insertedRole.id;
    }

    // 5. Create membership in public.tenant_memberships
    const { error: membershipError } = await admin
      .from("tenant_memberships")
      .upsert({
        tenant_id: newTenant.id,
        profile_id: userId,
        role_id: roleId,
        is_active: true,
      });

    if (membershipError) throw membershipError;

    // 6. Ensure business_modules is configured
    await admin.from("business_modules").upsert({
      tenant_id: newTenant.id,
      appointments: businessType === "appointment",
      ordering: businessType === "ordering",
      inventory: businessType === "ordering" || businessType === "retail",
    });

    // 7. Handle password setup / reset email or recovery link
    let emailSent = false;

    const origin =
      request.headers.get("origin") ||
      request.headers.get("referer") ||
      "http://localhost:3000";
    const cleanOrigin = origin.replace(/\/+$/, "");
    const redirectTo = `${cleanOrigin}/auth/confirm?next=/reset-password`;

    if (sendPasswordEmail) {
      try {
        // Send standard Supabase recovery email
        const { error: resetEmailError } =
          await admin.auth.resetPasswordForEmail(ownerEmail, {
            redirectTo,
          });

        if (!resetEmailError) {
          emailSent = true;
        }
      } catch (emailErr) {
        console.warn(
          "Could not dispatch password reset email directly:",
          emailErr,
        );
      }
    }

    // 8. Record audit log event (best-effort)
    try {
      await admin.from("team_access_events").insert({
        tenant_id: newTenant.id,
        actor_id: authData.user.id,
        action: "TENANT_MANUALLY_CREATED",
        details: {
          businessName: newTenant.business_name,
          slug: newTenant.slug,
          ownerEmail,
          plan,
          subscriptionStatus,
          emailSent,
        },
      });
    } catch {
      // Ignored if table not installed
    }

    return Response.json({
      success: true,
      tenant: {
        id: newTenant.id,
        name: newTenant.business_name,
        slug: newTenant.slug,
        businessType: newTenant.business_type,
        plan: newTenant.plan,
        subscriptionStatus: newTenant.subscription_status,
      },
      user: {
        id: userId,
        name: ownerName,
        email: ownerEmail,
      },
      emailSent,
      createdNewUser,
    });
  } catch (error) {
    return safeServerError(
      "admin-tenant-create",
      error,
      "Unable to create tenant. Please try again.",
    );
  }
}
