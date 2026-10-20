import {
  getPaymentProvider,
  PaymentConfigurationError,
} from "@/app/lib/billing/provider";
import { TRIAL_ENTITLEMENTS } from "@/app/lib/plans";
import { authorizeBillingOwner } from "@/app/lib/server/billing-authorization";
import {
  isValidUuid,
  readJsonBody,
  requestHasAllowedOrigin,
  safeServerError,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const tenantId =
      new URL(request.url).searchParams.get("tenantId")?.trim() ?? "";
    if (!isValidUuid(tenantId)) {
      return Response.json({ error: "Invalid business ID." }, { status: 400 });
    }
    const authorization = await authorizeBillingOwner(tenantId);
    if (!authorization.authorized) return authorization.response;
    const tenantColumns =
      "id,plan,subscription_status,trial_ends_at,created_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,provider_customer_id,provider_subscription_id,subscription_base_amount,subscription_seat_amount,subscription_recurring_total,subscription_paid_staff_seats";
    const { data, error } = await authorization.admin
      .from("tenants")
      .select(tenantColumns)
      .eq("id", tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return Response.json({ error: "Business not found." }, { status: 404 });

    let subscription = data;
    const paidLookingStatus = ["active", "cancelled", "canceled"].includes(
      String(data.subscription_status).toLowerCase(),
    );
    if (paidLookingStatus) {
      const { data: verifiedPayment, error: paymentError } =
        await authorization.admin
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
        const createdAt = new Date(data.created_at);
        const trialEndsAt =
          data.trial_ends_at ??
          new Date(
            (Number.isNaN(createdAt.getTime())
              ? Date.now()
              : createdAt.getTime()) +
              TRIAL_ENTITLEMENTS.lengthDays * 86_400_000,
          ).toISOString();
        const { data: repaired, error: repairError } = await authorization.admin
          .from("tenants")
          .update({
            subscription_status: "trial",
            trial_ends_at: trialEndsAt,
            current_period_start: null,
            current_period_end: null,
            cancel_at_period_end: false,
            canceled_at: null,
            provider_customer_id: null,
            provider_subscription_id: null,
            subscription_base_amount: 0,
            subscription_seat_amount: 0,
            subscription_recurring_total: 0,
            subscription_paid_staff_seats: 0,
            subscription_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", tenantId)
          .select(tenantColumns)
          .single();
        if (repairError) throw repairError;
        subscription = repaired;

        await authorization.admin
          .from("tenant_seat_entitlements")
          .update({ paid_staff_seats: 0, updated_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);
        await authorization.admin
          .from("business_notifications")
          .delete()
          .eq("tenant_id", tenantId)
          .eq("type", "SUBSCRIPTION")
          .eq("title", "Subscription active");
      }
    }

    return Response.json({
      subscription: {
        tenantId: subscription.id,
        plan: subscription.plan,
        status: subscription.subscription_status,
        trialEndsAt: subscription.trial_ends_at,
        currentPeriodStart: subscription.current_period_start,
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at,
        baseAmount: Number(subscription.subscription_base_amount ?? 0),
        seatAmount: Number(subscription.subscription_seat_amount ?? 0),
        recurringTotal: Number(subscription.subscription_recurring_total ?? 0),
        paidStaffSeats: Number(subscription.subscription_paid_staff_seats ?? 0),
      },
    });
  } catch (error) {
    return safeServerError(
      "subscription-summary",
      error,
      "Unable to load subscription details.",
    );
  }
}

interface SubscriptionActionBody {
  tenantId?: string;
  action?: "cancel_at_period_end";
}

export async function PATCH(request: Request) {
  if (!requestHasAllowedOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body = await readJsonBody<SubscriptionActionBody>(request, 2_048);
    const tenantId = body.tenantId?.trim() ?? "";
    if (!isValidUuid(tenantId) || body.action !== "cancel_at_period_end") {
      return Response.json(
        { error: "Invalid subscription request." },
        { status: 400 },
      );
    }
    const authorization = await authorizeBillingOwner(tenantId);
    if (!authorization.authorized) return authorization.response;
    const { data: tenant, error: tenantError } = await authorization.admin
      .from("tenants")
      .select(
        "subscription_status,current_period_end,cancel_at_period_end,provider_customer_id,provider_subscription_id",
      )
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantError) throw tenantError;
    const periodEnd = tenant?.current_period_end
      ? new Date(tenant.current_period_end)
      : null;
    if (
      !tenant ||
      tenant.subscription_status?.toLowerCase() !== "active" ||
      tenant.cancel_at_period_end ||
      !periodEnd ||
      Number.isNaN(periodEnd.getTime()) ||
      periodEnd <= new Date()
    ) {
      return Response.json(
        { error: "This business does not have a current paid subscription." },
        { status: 409 },
      );
    }
    const provider = getPaymentProvider();
    await provider.scheduleCancellation({
      tenantId,
      providerCustomerId: tenant.provider_customer_id ?? undefined,
      providerSubscriptionId: tenant.provider_subscription_id ?? undefined,
      currentPeriodEnd: tenant.current_period_end,
    });
    const { data, error } = await authorization.admin.rpc(
      "cancel_tenant_subscription_at_period_end",
      { p_tenant_id: tenantId },
    );
    if (error) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ subscription: data });
  } catch (error) {
    if (error instanceof PaymentConfigurationError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    return safeServerError(
      "subscription-cancellation",
      error,
      "Unable to schedule subscription cancellation.",
    );
  }
}
