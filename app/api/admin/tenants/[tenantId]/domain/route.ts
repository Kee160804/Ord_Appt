import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import { safeServerError } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ tenantId: string }> };

function validUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await context.params;
    if (!validUuid(tenantId)) {
      return Response.json({ error: "Invalid business ID." }, { status: 400 });
    }
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
    const body = (await request.json()) as { verified?: unknown };
    if (typeof body.verified !== "boolean") {
      return Response.json(
        { error: "A verification state is required." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("platform_role, is_active")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (
      !profile?.is_active ||
      profile.platform_role?.toUpperCase() !== "SUPER_ADMIN"
    ) {
      return Response.json(
        { error: "Only a platform super admin can verify custom domains." },
        { status: 403 },
      );
    }

    const verifiedAt = body.verified ? new Date().toISOString() : null;
    const { data: tenant, error: updateError } = await admin
      .from("tenants")
      .update({ custom_domain_verified_at: verifiedAt })
      .eq("id", tenantId)
      .not("custom_domain", "is", null)
      .select("custom_domain, custom_domain_verified_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!tenant) {
      return Response.json(
        { error: "The business has no custom domain to verify." },
        { status: 409 },
      );
    }
    return Response.json({
      domain: tenant.custom_domain,
      verified: Boolean(tenant.custom_domain_verified_at),
    });
  } catch (error) {
    return safeServerError(
      "admin-domain-verification",
      error,
      "Unable to update custom-domain verification.",
    );
  }
}
