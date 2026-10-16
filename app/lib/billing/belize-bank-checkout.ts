import "server-only";

import {
  expectedBelizeBankAmountMinor,
  getBelizeBankOrderStatus,
} from "@/app/lib/billing/belize-bank";
import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import type { PlanType } from "@/app/types";

export interface BelizeBankCheckoutSession {
  id: string;
  tenant_id: string;
  request_id: string;
  merchant_order_number: string;
  gateway_order_id: string | null;
  form_url: string | null;
  plan: PlanType;
  paid_staff_seats: number;
  base_amount: number | string;
  seat_amount: number | string;
  total_amount: number | string;
  currency: string;
  status: string;
  gateway_status: number | null;
  last_operation: string | null;
  metadata: Record<string, unknown> | null;
}

export type BelizeBankCheckoutState =
  "pending" | "completed" | "failed" | "cancelled" | "refunded";

const SESSION_COLUMNS =
  "id,tenant_id,request_id,merchant_order_number,gateway_order_id,form_url,plan,paid_staff_seats,base_amount,seat_amount,total_amount,currency,status,gateway_status,last_operation,metadata";

export async function findBelizeBankCheckoutByRequest(
  tenantId: string,
  requestId: string,
) {
  const { data, error } = await getSupabaseAdminClient()
    .from("subscription_checkout_sessions")
    .select(SESSION_COLUMNS)
    .eq("tenant_id", tenantId)
    .eq("request_id", requestId)
    .maybeSingle();
  if (error) throw error;
  return (data as BelizeBankCheckoutSession | null) ?? null;
}

export async function findBelizeBankCheckoutForCallback(
  gatewayOrderId: string,
  merchantOrderNumber: string,
) {
  const admin = getSupabaseAdminClient();
  if (gatewayOrderId) {
    const { data, error } = await admin
      .from("subscription_checkout_sessions")
      .select(SESSION_COLUMNS)
      .eq("gateway_order_id", gatewayOrderId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data as BelizeBankCheckoutSession;
  }
  if (!merchantOrderNumber) return null;
  const { data, error } = await admin
    .from("subscription_checkout_sessions")
    .select(SESSION_COLUMNS)
    .eq("merchant_order_number", merchantOrderNumber)
    .maybeSingle();
  if (error) throw error;
  return (data as BelizeBankCheckoutSession | null) ?? null;
}

function publicState(status: string): BelizeBankCheckoutState {
  if (status === "SUCCEEDED") return "completed";
  if (status === "FAILED") return "failed";
  if (status === "CANCELLED") return "cancelled";
  if (status === "REFUNDED") return "refunded";
  return "pending";
}

export async function reconcileBelizeBankSubscriptionCheckout(
  session: BelizeBankCheckoutSession,
  operation?: string,
) {
  if (!session.gateway_order_id) {
    return { state: publicState(session.status), gatewayStatus: null };
  }

  const gateway = await getBelizeBankOrderStatus(session.gateway_order_id);
  const admin = getSupabaseAdminClient();
  const expectedMinor = expectedBelizeBankAmountMinor(
    Number(session.total_amount),
  );
  const metadata = {
    ...(session.metadata ?? {}),
    maskedPan: gateway.maskedPan,
    approvalCode: gateway.approvalCode,
    authorizedAt: gateway.authorizedAt,
  };
  const commonUpdate = {
    gateway_status: gateway.orderStatus,
    last_operation: operation?.slice(0, 64) || session.last_operation,
    metadata,
    verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (gateway.orderStatus === 2) {
    if (gateway.amountMinor !== expectedMinor) {
      await admin
        .from("subscription_checkout_sessions")
        .update({
          ...commonUpdate,
          status: "FAILED",
          last_error: "Gateway amount did not match the subscription total.",
        })
        .eq("id", session.id);
      throw new Error("Belize Bank payment amount verification failed.");
    }

    const idempotencyKey = `subscription-checkout/${session.tenant_id}/${session.request_id}`;
    const { data, error } = await admin.rpc(
      "complete_subscription_checkout_v2",
      {
        p_tenant_id: session.tenant_id,
        p_plan: session.plan,
        p_paid_staff_seats: Number(session.paid_staff_seats),
        p_expected_base_amount: Number(session.base_amount),
        p_expected_seat_amount: Number(session.seat_amount),
        p_expected_total: Number(session.total_amount),
        p_provider: "BELIZE_BANK",
        p_provider_reference: session.gateway_order_id,
        p_provider_customer_id: "",
        p_provider_subscription_id: "",
        p_idempotency_key: idempotencyKey,
      },
    );
    if (error) throw error;
    await admin
      .from("subscription_checkout_sessions")
      .update({
        ...commonUpdate,
        status: "SUCCEEDED",
        last_error: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    return {
      state: "completed" as const,
      gatewayStatus: 2,
      subscription: data,
    };
  }

  if (gateway.orderStatus === 4) {
    if (
      gateway.amountMinor !== undefined &&
      gateway.amountMinor !== expectedMinor
    ) {
      throw new Error("Belize Bank refund amount verification failed.");
    }
    await admin
      .from("subscription_checkout_sessions")
      .update({ ...commonUpdate, status: "REFUNDED", last_error: null })
      .eq("id", session.id);
    await admin
      .from("payment_transactions")
      .update({
        status: "REFUNDED",
        refunded_amount: Number(session.total_amount),
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("provider", "BELIZE_BANK")
      .eq("provider_reference", session.gateway_order_id);
    return { state: "refunded" as const, gatewayStatus: 4 };
  }

  if (gateway.orderStatus === 3 || gateway.orderStatus === 6) {
    const status = gateway.orderStatus === 3 ? "CANCELLED" : "FAILED";
    await admin
      .from("subscription_checkout_sessions")
      .update({
        ...commonUpdate,
        status,
        last_error:
          gateway.orderStatus === 3
            ? "The payment was cancelled."
            : "The payment was declined.",
      })
      .eq("id", session.id);
    return {
      state:
        gateway.orderStatus === 3
          ? ("cancelled" as const)
          : ("failed" as const),
      gatewayStatus: gateway.orderStatus,
    };
  }

  await admin
    .from("subscription_checkout_sessions")
    .update({ ...commonUpdate, status: "PENDING", last_error: null })
    .eq("id", session.id);
  return { state: "pending" as const, gatewayStatus: gateway.orderStatus };
}
