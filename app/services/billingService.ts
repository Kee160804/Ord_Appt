import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { PlanType } from "@/app/types";

export interface BillingTransaction {
  id: string;
  tenantId: string;
  kind: string;
  amount: number;
  refundedAmount: number;
  currency: string;
  status: string;
  provider: string;
  reference: string;
  createdAt: string;
}
export interface BillingInvoice {
  id: string;
  tenantId: string;
  number: string;
  plan: PlanType;
  amount: number;
  currency: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  paidAt?: string;
}

function client() {
  const value = getSupabaseBrowserClient();
  if (!value) throw new Error("Billing is not configured.");
  return value;
}

export async function listBillingLedger(tenantId?: string) {
  let transactionQuery = client()
    .from("payment_transactions")
    .select(
      "id,tenant_id,kind,amount,refunded_amount,currency,status,provider,provider_reference,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  let invoiceQuery = client()
    .from("subscription_invoices")
    .select(
      "id,tenant_id,invoice_number,plan,amount,currency,status,period_start,period_end,paid_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (tenantId) {
    transactionQuery = transactionQuery.eq("tenant_id", tenantId);
    invoiceQuery = invoiceQuery.eq("tenant_id", tenantId);
  }
  const [transactionsResult, invoicesResult] = await Promise.all([
    transactionQuery,
    invoiceQuery,
  ]);
  if (transactionsResult.error) throw transactionsResult.error;
  if (invoicesResult.error) throw invoicesResult.error;
  return {
    transactions: (transactionsResult.data ?? []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      kind: row.kind,
      amount: Number(row.amount),
      refundedAmount: Number(row.refunded_amount),
      currency: row.currency,
      status: row.status,
      provider: row.provider,
      reference: row.provider_reference,
      createdAt: row.created_at,
    })) as BillingTransaction[],
    invoices: (invoicesResult.data ?? []).map((row) => ({
      id: row.id,
      tenantId: row.tenant_id,
      number: row.invoice_number,
      plan: row.plan as PlanType,
      amount: Number(row.amount),
      currency: row.currency,
      status: row.status,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      paidAt: row.paid_at ?? undefined,
    })) as BillingInvoice[],
  };
}

export async function runMockSubscriptionCheckout(
  tenantId: string,
  plan: PlanType,
) {
  const response = await fetch("/api/billing/mock-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, plan }),
  });
  const result = (await response.json()) as {
    error?: string;
    paymentReference?: string;
    plan?: PlanType;
    status?: string;
  };
  if (!response.ok)
    throw new Error(result.error || "Unable to complete mock checkout.");
  return result;
}
