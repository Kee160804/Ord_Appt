import { authorizeActiveSuperAdmin } from "@/app/lib/server/admin-authorization";
import {
  PLAN_DEFINITIONS,
  TRIAL_ENTITLEMENTS,
  calculateSubscriptionAmounts,
} from "@/app/lib/plans";
import { isValidUuid, safeServerError } from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PLANS = new Set(["starter", "pro", "enterprise"]);
const VALID_STATUSES = new Set([
  "trial",
  "trialing",
  "active",
  "cancelled",
  "canceled",
  "past_due",
  "expired",
]);

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
      (status === "trial" || status === "trialing") &&
      (trialDays === null ||
        !Number.isInteger(trialDays) ||
        trialDays < 1 ||
        trialDays > TRIAL_ENTITLEMENTS.lengthDays)
    ) {
      return Response.json(
        {
          error: `Trial extension must be a whole number between 1 and ${TRIAL_ENTITLEMENTS.lengthDays} days.`,
        },
        { status: 400 },
      );
    }

    const { data: existingTenant, error: existingTenantError } = await admin
      .from("tenants")
      .select("id,subscription_paid_staff_seats,trial_ends_at")
      .eq("id", tenantId)
      .maybeSingle();
    if (existingTenantError) throw existingTenantError;
    if (!existingTenant) {
      return Response.json({ error: "Business not found." }, { status: 404 });
    }

    if (status === "active") {
      const { data: verifiedPayment, error: paymentError } = await admin
        .from("payment_transactions")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("kind", "SUBSCRIPTION")
        .eq("provider", "BELIZE_BANK")
        .in("status", ["SUCCEEDED", "PARTIALLY_REFUNDED"])
        .not("paid_at", "is", null)
        .limit(1)
        .maybeSingle();
      if (paymentError) throw paymentError;
      if (!verifiedPayment) {
        return Response.json(
          {
            error:
              "Paid access requires a successfully verified Belize Bank subscription payment.",
          },
          { status: 409 },
        );
      }
    }

    const planDefinition =
      PLAN_DEFINITIONS[plan as keyof typeof PLAN_DEFINITIONS];
    const maximumPaidSeats =
      planDefinition.maxStaffSeats - planDefinition.includedStaffSeats;
    const paidStaffSeats = Math.min(
      Number(existingTenant.subscription_paid_staff_seats ?? 0),
      maximumPaidSeats,
    );
    const amounts = calculateSubscriptionAmounts(
      plan as keyof typeof PLAN_DEFINITIONS,
      paidStaffSeats,
    );
    const updates: Record<string, unknown> = {
      plan,
      subscription_status: status,
      subscription_base_amount: amounts.baseAmount,
      subscription_seat_amount: amounts.seatAmount,
      subscription_recurring_total: amounts.recurringTotal,
      subscription_paid_staff_seats: paidStaffSeats,
      subscription_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (status === "trial" || status === "trialing") {
      const days = trialDays ?? TRIAL_ENTITLEMENTS.lengthDays;
      const existingTrialEnd = existingTenant.trial_ends_at
        ? new Date(existingTenant.trial_ends_at)
        : null;
      const extensionStartsAt =
        existingTrialEnd &&
        !Number.isNaN(existingTrialEnd.getTime()) &&
        existingTrialEnd.getTime() > Date.now()
          ? existingTrialEnd
          : new Date();
      updates.trial_ends_at = new Date(
        extensionStartsAt.getTime() + days * 86_400_000,
      ).toISOString();
      updates.subscription_base_amount = 0;
      updates.subscription_seat_amount = 0;
      updates.subscription_recurring_total = 0;
      updates.current_period_start = null;
      updates.current_period_end = null;
      updates.cancel_at_period_end = false;
      updates.canceled_at = null;
    } else if (status === "active") {
      const periodStart = new Date();
      const periodEnd = new Date(periodStart);
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
      updates.current_period_start = periodStart.toISOString();
      updates.current_period_end = periodEnd.toISOString();
      updates.cancel_at_period_end = false;
      updates.canceled_at = null;
    }

    const { data: tenant, error: updateError } = await admin
      .from("tenants")
      .update(updates)
      .eq("id", tenantId)
      .select(
        "id,plan,subscription_status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,subscription_base_amount,subscription_seat_amount,subscription_recurring_total,subscription_paid_staff_seats",
      )
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
          currentPeriodEnd: tenant.current_period_end,
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
        currentPeriodStart: tenant.current_period_start ?? undefined,
        currentPeriodEnd: tenant.current_period_end ?? undefined,
        cancelAtPeriodEnd: tenant.cancel_at_period_end,
        baseAmount: Number(tenant.subscription_base_amount ?? 0),
        seatAmount: Number(tenant.subscription_seat_amount ?? 0),
        recurringTotal: Number(tenant.subscription_recurring_total ?? 0),
        paidStaffSeats: Number(tenant.subscription_paid_staff_seats ?? 0),
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
