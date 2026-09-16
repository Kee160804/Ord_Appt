import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

import type {
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
} from "@/app/types/index";

import type {
  OrderItemRow,
  OrderProductRow,
  OrderRow,
} from "@/app/types/supabase";

/**
 * Public checkout item submitted from the storefront.
 */
export interface PublicOrderItemInput {
  productId: string;
  quantity: number;

  addons: {
    id: string;
    name: string;
    price: number;
  }[];

  variantId?: string;
}

/**
 * Public order payload submitted by a storefront customer.
 */
export interface PublicOrderInput {
  tenantId: string;

  customerName: string;
  customerEmail: string;
  customerPhone: string;

  orderType: "dine_in" | "pickup" | "delivery";

  items: PublicOrderItemInput[];

  promotionCode?: string;
  requestedTime?: string;

  deliveryAddress?: string;
  deliveryArea?: string;
  deliveryInstructions?: string;

  tableNumber?: string;

  notes?: string;

  paymentMethod?: "pay_later" | "mock_card";
}

/**
 * Confirmation returned after an order is successfully created.
 */
export interface PublicOrderResult {
  orderId: string;
  orderNumber: string;
  total: number;

  paymentStatus: PaymentStatus;

  paymentReference?: string;
}

/**
 * Returns the configured Supabase browser client.
 */
function client() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

/**
 * Normalizes errors returned during public order creation.
 */
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

/**
 * Converts database status values into the application's OrderStatus type.
 */
function normalizeOrderStatus(value: string): OrderStatus {
  switch (value.toUpperCase()) {
    case "CONFIRMED":
      return "confirmed";

    case "PREPARING":
      return "preparing";

    case "READY":
      return "ready";

    case "OUT_FOR_DELIVERY":
      return "out_for_delivery";

    case "DELIVERED":
    case "COMPLETED":
      return "delivered";

    case "CANCELLED":
      return "cancelled";

    default:
      return "pending";
  }
}

/**
 * Converts database payment states into the application's PaymentStatus type.
 */
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

/**
 * Supabase relations can be returned as either:
 * - one object
 * - an array
 * - null
 *
 * Normalize that relationship into one product row.
 */
function firstProduct(value: OrderItemRow["products"]): OrderProductRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

/**
 * Maps an order item database row into the application's OrderItem type.
 */
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

/**
 * Maps a database order into the application's Order type.
 */
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

/**
 * Pagination metadata returned with one tenant order page.
 *
 * Pages are zero-based because Supabase range offsets are also zero-based.
 */
export interface OrderPage {
  orders: Order[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * Optional database-backed filters for the Orders screen.
 *
 * Search/filtering belongs here instead of in React so the UI searches the
 * tenant's complete order history rather than only the currently loaded page.
 */
export interface ListOrdersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OrderStatus | "all";
  paymentStatus?: PaymentStatus | "all";
}

const DEFAULT_ORDER_PAGE_SIZE = 25;
const MAX_ORDER_PAGE_SIZE = 100;
const MAX_ORDER_SEARCH_LENGTH = 120;

function normalizePage(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value ?? 0));
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_ORDER_PAGE_SIZE;

  return Math.min(
    MAX_ORDER_PAGE_SIZE,
    Math.max(1, Math.floor(value ?? DEFAULT_ORDER_PAGE_SIZE)),
  );
}

/**
 * Escape characters that have structural meaning inside a PostgREST `.or()`
 * expression.
 *
 * The value is still used only with known columns and `ilike`; callers cannot
 * supply a column/operator through the search box.
 */
function normalizeOrderSearch(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .slice(0, MAX_ORDER_SEARCH_LENGTH)
    .replace(/[(),]/g, " ")
    .trim();
}

/**
 * Loads one tenant-scoped order page.
 *
 * Scaling rules:
 * - Pagination happens in Supabase.
 * - Search and filters happen before pagination.
 * - Exact count supplies UI pagination metadata.
 * - Tenant filtering is always part of the query.
 * - created_at + id provides deterministic page ordering.
 */
export async function listOrders(
  tenantId: string,
  options: ListOrdersOptions = {},
): Promise<OrderPage> {
  const safePage = normalizePage(options.page);
  const safePageSize = normalizePageSize(options.pageSize);
  const search = normalizeOrderSearch(options.search);

  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;

  let query = client()
    .from("orders")
    .select(
      `
        id,
        tenant_id,
        customer_id,
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        status,
        payment_status,
        total,
        notes,
        created_at,
        order_items(
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          subtotal,
          products(image_url)
        )
      `,
      { count: "exact" },
    )
    .eq("tenant_id", tenantId);

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status.toUpperCase());
  }

  if (options.paymentStatus && options.paymentStatus !== "all") {
    query = query.eq("payment_status", options.paymentStatus.toUpperCase());
  }

  if (search) {
    query = query.or(
      [
        `order_number.ilike.%${search}%`,
        `customer_name.ilike.%${search}%`,
        `customer_email.ilike.%${search}%`,
        `customer_phone.ilike.%${search}%`,
      ].join(","),
    );
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  if (error) {
    throw error;
  }

  const orders = ((data ?? []) as unknown as OrderRow[]).map(mapOrder);
  const total = count ?? 0;
  const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);

  return {
    orders,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPreviousPage: safePage > 0,
    hasNextPage: from + orders.length < total,
  };
}

/**
 * Creates an order through the protected public order API.
 *
 * Public checkout should continue going through the server route
 * rather than directly inserting into Supabase from the browser.
 */
export async function createPublicOrder(
  input: PublicOrderInput,
): Promise<PublicOrderResult> {
  const response = await fetch("/api/public/orders", {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  const result = (await response.json()) as {
    orderId?: string;
    orderNumber?: string;

    total?: number;

    paymentStatus?: string;

    paymentReference?: string | null;

    error?: string;
  };

  if (!response.ok) {
    throw orderCreationError(
      new Error(result.error || "Unable to place order."),
    );
  }

  if (!result.orderId || !result.orderNumber) {
    throw new Error("The order was created without a confirmation number.");
  }

  return {
    orderId: result.orderId,

    orderNumber: result.orderNumber,

    total: Number(result.total),

    paymentStatus: normalizePaymentStatus(result.paymentStatus || "UNPAID"),

    paymentReference: result.paymentReference || undefined,
  };
}

/**
 * Updates an order's operational status.
 *
 * The tenant constraint prevents accidentally updating an order
 * belonging to a different business.
 */
export async function setOrderStatus(
  tenantId: string,
  orderId: string,
  status: OrderStatus,
) {
  const { error } = await client()
    .from("orders")
    .update({
      status: status.toUpperCase(),
    })
    .eq("id", orderId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) {
    throw error;
  }
}
