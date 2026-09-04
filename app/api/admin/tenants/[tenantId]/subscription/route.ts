import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import { getSupabaseServerClient } from "@/app/lib/supabase/server";
import { safeServerError } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PLANS = new Set(["starter", "pro", "enterprise"]);
const VALID_STATUSES = new Set(["trial", "active", "cancelled", "past_due"]);

type RouteContext = { params: Promise<{ tenantId: string }> };

interface SubscriptionRequest {
  plan?: unknown;
  status?: unknown;
  trialDays?: unknown;
}

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

    const body = (await request.json()) as SubscriptionRequest;
    const plan =
      typeof body.plan === "string" ? body.plan.trim().toLowerCase() : "";
    const status =
      typeof body.status === "string" ? body.status.trim().toLowerCase() : "";
    const trialDays = body.trialDays == null ? null : Number(body.trialDays);
    if (!VALID_PLANS.has(plan) || !VALID_STATUSES.has(status)) {
      return Response.json(
        { error: "Choose a valid plan and access status." },
        { status: 400 },
      );
    }
    if (
      status === "trial" &&
      trialDays !== null &&
      (!Number.isInteger(trialDays) || trialDays < 1 || trialDays > 365)
    ) {
      return Response.json(
        { error: "Trial days must be a whole number between 1 and 365." },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdminClient();
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
        {
          error: "Only a platform super admin can change subscription access.",
        },
        { status: 403 },
      );
    }

    const updates: Record<string, string> = {
      plan,
      subscription_status: status,
      updated_at: new Date().toISOString(),
    };
    if (status === "trial") {
      const days = trialDays ?? 14;
      updates.trial_ends_at = new Date(
        Date.now() + days * 86_400_000,
      ).toISOString();
    }

    const { data: tenant, error: updateError } = await admin
      .from("tenants")
      .update(updates)
      .eq("id", tenantId)
      .select("id, plan, subscription_status, trial_ends_at")
      .maybeSingle();
    if (updateError) {
      const message =
        updateError.message || "Unable to save subscription access.";
      const statusCode =
        message.includes("staff") || message.includes("seat") ? 409 : 400;
      return Response.json({ error: message }, { status: statusCode });
    }
    if (!tenant) {
      return Response.json({ error: "Business not found." }, { status: 404 });
    }

    // The audit table is installed with Team & Access. Keep the subscription
    // override successful if an older project has not installed that table.
    const { error: auditError } = await admin
      .from("team_access_events")
      .insert({
        tenant_id: tenantId,
        actor_id: authData.user.id,
        action: "SUBSCRIPTION_OVERRIDE_SET",
        details: {
          plan: tenant.plan,
          subscriptionStatus: tenant.subscription_status,
          trialEndsAt: tenant.trial_ends_at,
          source: "super_admin_testing_control",
        },
      });
    if (auditError) {
      console.warn("[subscription-admin-audit]", auditError.message);
    }

    return Response.json({
      subscription: {
        plan: tenant.plan,
        subscriptionStatus: tenant.subscription_status,
        trialEndsAt: tenant.trial_ends_at ?? undefined,
      },
    });
  } catch (error) {
    return safeServerError(
      "admin-subscription-update",
      error,
      "Unable to save subscription access.",
    );
  }
}
