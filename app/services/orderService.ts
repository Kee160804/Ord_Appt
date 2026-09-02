import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { Order, OrderItem, OrderStatus, PaymentStatus } from "@/app/types/index";
import type { OrderItemRow, OrderProductRow, OrderRow } from "@/app/types/supabase";

export interface PublicOrderItemInput {
  productId: string;
  quantity: number;
  addons: { id: string; name: string; price: number }[];
}

export interface PublicOrderInput {
  tenantId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderType: "dine_in" | "pickup" | "delivery";
  items: PublicOrderItemInput[];
  promotionCode?: string;
}

export interface PublicOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function orderCreationError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PGRST202"
  ) {
    return new Error(
      "Online ordering is not enabled for this store yet. Apply the public order checkout migration in Supabase, then try again.",
    );
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return new Error(error.message);
  }
  return error instanceof Error ? error : new Error("Unable to place order.");
}

function normalizeOrderStatus(value: string): OrderStatus {
  switch (value.toUpperCase()) {
    case "CONFIRMED":
      return "confirmed";
    case "PREPARING":
      return "preparing";
    case "READY":
      return "ready";
    case "DELIVERED":
    case "COMPLETED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    default:
      return "pending";
  }
}

function normalizePaymentStatus(value: string): PaymentStatus {
  switch (value.toUpperCase()) {
    case "PAID":
    case "COMPLETED":
      return "paid";
    case "PARTIAL":
      return "partial";
    case "REFUNDED":
      return "refunded";
    default:
      return "unpaid";
  }
}

function firstProduct(value: OrderItemRow["products"]): OrderProductRow | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function mapItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    productId: row.product_id ?? "",
    productName: row.product_name,
    productImage: firstProduct(row.products)?.image_url ?? "",
    quantity: Number(row.quantity),
    price: Number(row.unit_price),
  };
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id ?? undefined,
    orderNumber: row.order_number,
    customerName: row.customer_name?.trim() || "Customer",
    customerEmail: row.customer_email ?? "",
    customerPhone: row.customer_phone ?? "",
    items: (row.order_items ?? []).map(mapItem),
    status: normalizeOrderStatus(row.status),
    paymentStatus: normalizePaymentStatus(row.payment_status),
    totalAmount: Number(row.total),
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listOrders(tenantId: string): Promise<Order[]> {
  const { data, error } = await client()
    .from("orders")
    .select(
      "id, tenant_id, customer_id, order_number, customer_name, customer_email, customer_phone, status, payment_status, total, notes, created_at, order_items(id, product_id, product_name, quantity, unit_price, subtotal, products(image_url))",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
}

export async function createPublicOrder(input: PublicOrderInput): Promise<PublicOrderResult> {
  const payload = {
    p_tenant_id: input.tenantId,
    p_customer_name: input.customerName.trim(),
    p_customer_email: input.customerEmail.trim().toLowerCase(),
    p_customer_phone: input.customerPhone.trim(),
    p_order_type: input.orderType,
    p_notes: null,
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      addons: item.addons.map(({ id }) => ({ id })),
    })),
    p_promotion_code: input.promotionCode?.trim() || null,
  };
  let { data, error } = await client().rpc("create_public_order_with_email", payload);

  // Rolling-deploy safety: storefront orders remain usable if the application
  // reaches Vercel before the additive email migration reaches Supabase.
  if (error?.code === "PGRST202") {
    const usePromotion = Boolean(input.promotionCode?.trim());
    const fallback = await client().rpc(usePromotion ? "create_public_order_with_promotion" : "create_public_order", {
      p_tenant_id: input.tenantId,
      p_customer_name: input.customerName.trim(),
      p_customer_phone: input.customerPhone.trim(),
      p_order_type: input.orderType,
      p_notes: null,
      p_items: payload.p_items,
      ...(usePromotion ? { p_promotion_code: input.promotionCode?.trim() || null } : {}),
    });
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw orderCreationError(error);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.order_id || !result.order_number) {
    throw new Error("The order was created without a confirmation number.");
  }
  return {
    orderId: result.order_id as string,
    orderNumber: result.order_number as string,
    total: Number(result.total),
  };
}

export async function setOrderStatus(
  tenantId: string,
  orderId: string,
  status: OrderStatus,
) {
  const { error } = await client()
    .from("orders")
    .update({ status: status.toUpperCase() })
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) throw error;
}

export async function deleteOrder(tenantId: string, orderId: string) {
  const { error } = await client()
    .from("orders")
    .delete()
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) throw error;
}
