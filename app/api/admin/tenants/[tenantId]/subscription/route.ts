import { authorizeActiveSuperAdmin } from "@/app/lib/server/admin-authorization";
import { isValidUuid, safeServerError } from "@/app/lib/server/security";

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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { tenantId } = await context.params;
    if (!isValidUuid(tenantId)) {
      return Response.json({ error: "Invalid business ID." }, { status: 400 });
    }

    const authorization = await authorizeActiveSuperAdmin(
      "Only a platform super admin can change subscription access.",
    );
    if (!authorization.authorized) return authorization.response;

    const { admin, userId: callerId } = authorization;

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
        actor_id: callerId,
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
