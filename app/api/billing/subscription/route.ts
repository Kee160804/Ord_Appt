import {
  getPaymentProvider,
  PaymentConfigurationError,
} from "@/app/lib/billing/provider";
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
    const { data, error } = await authorization.admin
      .from("tenants")
      .select(
        "id,plan,subscription_status,trial_ends_at,current_period_start,current_period_end,cancel_at_period_end,canceled_at,provider_customer_id,provider_subscription_id,subscription_base_amount,subscription_seat_amount,subscription_recurring_total,subscription_paid_staff_seats",
      )
      .eq("id", tenantId)
      .maybeSingle();
    if (error) throw error;
    if (!data)
      return Response.json({ error: "Business not found." }, { status: 404 });
    return Response.json({
      subscription: {
        tenantId: data.id,
        plan: data.plan,
        status: data.subscription_status,
        trialEndsAt: data.trial_ends_at,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        canceledAt: data.canceled_at,
        baseAmount: Number(data.subscription_base_amount ?? 0),
        seatAmount: Number(data.subscription_seat_amount ?? 0),
        recurringTotal: Number(data.subscription_recurring_total ?? 0),
        paidStaffSeats: Number(data.subscription_paid_staff_seats ?? 0),
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
