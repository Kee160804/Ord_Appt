import {
  calculateSubscriptionAmounts,
  validateSubscriptionSeatSelection,
} from "@/app/lib/plans";
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
import type { PlanType } from "@/app/types";

export const runtime = "nodejs";

interface CheckoutBody {
  tenantId?: string;
  plan?: PlanType;
  paidStaffSeats?: number;
  requestId?: string;
}

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const body = await readJsonBody<CheckoutBody>(request, 4_096);
    const tenantId = body.tenantId?.trim() ?? "";
    const requestId = body.requestId?.trim() ?? "";
    if (!isValidUuid(tenantId) || !isValidUuid(requestId) || !body.plan) {
      return Response.json(
        { error: "Invalid checkout request." },
        { status: 400 },
      );
    }
    const paidStaffSeats = Number(body.paidStaffSeats ?? 0);
    let amounts;
    try {
      amounts = calculateSubscriptionAmounts(body.plan, paidStaffSeats);
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Choose a valid plan.",
        },
        { status: 400 },
      );
    }
    const authorization = await authorizeBillingOwner(tenantId);
    if (!authorization.authorized) return authorization.response;

    const { data: tenant, error: tenantError } = await authorization.admin
      .from("tenants")
      .select(
        "id,business_name,plan,current_period_end,provider_customer_id,provider_subscription_id,subscription_paid_staff_seats",
      )
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant) {
      return Response.json({ error: "Business not found." }, { status: 404 });
    }

    const { data: activeMemberships, error: membershipsError } =
      await authorization.admin
        .from("tenant_memberships")
        .select("roles(name)")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);
    if (membershipsError) throw membershipsError;
    const activeStaff = (activeMemberships ?? []).filter((membership) => {
      const roles = membership.roles as unknown as
        { name?: string } | Array<{ name?: string }> | null;
      const roleName = Array.isArray(roles) ? roles[0]?.name : roles?.name;
      return roleName?.toUpperCase() !== "OWNER";
    }).length;
    try {
      validateSubscriptionSeatSelection(body.plan, paidStaffSeats, activeStaff);
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Choose enough seats for the active team.",
        },
        { status: 409 },
      );
    }

    const provider = getPaymentProvider();
    const idempotencyKey = `subscription-checkout/${tenantId}/${requestId}`;
    const providerResult = await provider.createOrUpdateSubscription({
      tenantId,
      ownerId: authorization.user.id,
      ownerEmail: authorization.user.email ?? "",
      businessName: tenant.business_name,
      currentPlan:
        tenant.plan === "pro" || tenant.plan === "enterprise"
          ? tenant.plan
          : "starter",
      currentPaidStaffSeats: Number(tenant.subscription_paid_staff_seats ?? 0),
      currentPeriodEnd: tenant.current_period_end ?? undefined,
      providerCustomerId: tenant.provider_customer_id ?? undefined,
      providerSubscriptionId: tenant.provider_subscription_id ?? undefined,
      plan: body.plan,
      paidStaffSeats,
      baseAmount: amounts.baseAmount,
      seatAmount: amounts.seatAmount,
      recurringTotal: amounts.recurringTotal,
      currency: amounts.currency,
      idempotencyKey,
    });

    if (providerResult.status === "pending") {
      return Response.json({
        status: "pending",
        redirectUrl: providerResult.redirectUrl,
        amounts,
      });
    }

    const { data, error } = await authorization.admin.rpc(
      "complete_subscription_checkout_v2",
      {
        p_tenant_id: tenantId,
        p_plan: body.plan,
        p_paid_staff_seats: paidStaffSeats,
        p_expected_base_amount: amounts.baseAmount,
        p_expected_seat_amount: amounts.seatAmount,
        p_expected_total: amounts.recurringTotal,
        p_provider: providerResult.provider,
        p_provider_reference: providerResult.providerReference,
        p_provider_customer_id: providerResult.providerCustomerId ?? "",
        p_provider_subscription_id: providerResult.providerSubscriptionId ?? "",
        p_idempotency_key: idempotencyKey,
      },
    );
    if (error) {
      const status = /staff|seat|plan|pricing/i.test(error.message) ? 409 : 400;
      return Response.json({ error: error.message }, { status });
    }
    return Response.json({
      status: "completed",
      isMock: providerResult.isMock,
      subscription: data,
    });
  } catch (error) {
    if (error instanceof PaymentConfigurationError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    return safeServerError(
      "subscription-checkout",
      error,
      "Unable to complete subscription checkout.",
    );
  }
}
