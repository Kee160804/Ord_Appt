import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";

import {
  enforcePublicRateLimit,
  isValidEmail,
  isValidUuid,
  publicOperationError,
  rateLimitResponse,
  readJsonBody,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Maximum values accepted by the public order endpoint.
 *
 * These limits prevent unusually large public requests from reaching
 * pricing/inventory RPCs unnecessarily.
 */
const MAX_ORDER_ITEMS = 100;
const MAX_ADDONS_PER_ITEM = 30;

const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 40;
const MAX_ADDRESS_LENGTH = 500;
const MAX_INSTRUCTIONS_LENGTH = 1_000;
const MAX_NOTES_LENGTH = 2_000;
const MAX_PROMOTION_CODE_LENGTH = 100;
const MAX_TABLE_NUMBER_LENGTH = 50;

/**
 * Public order payload submitted by the storefront.
 *
 * All fields remain optional at the TypeScript boundary because public
 * request data is untrusted. Runtime validation below determines whether
 * the request is actually acceptable.
 */
interface OrderRequest {
  tenantId?: string;

  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  orderType?: "dine_in" | "pickup" | "delivery";

  items?: Array<{
    productId?: string;
    quantity?: number;
    variantId?: string;

    addons?: Array<{
      id?: string;
    }>;
  }>;

  requestedTime?: string;

  deliveryAddress?: string;
  deliveryArea?: string;
  deliveryInstructions?: string;

  tableNumber?: string;
  notes?: string;
  promotionCode?: string;

  /**
   * Real payment-provider methods will be introduced later.
   * For now, only the existing development/payment modes are accepted.
   */
  paymentMethod?: "pay_later" | "mock_card";

  /**
   * Honeypot field.
   *
   * Real users should never populate this field.
   */
  website?: string;
}

type NormalizedOrderItem = {
  product_id: string;
  quantity: number;
  variant_id: string | null;
  addons: Array<{
    id: string;
  }>;
};

/**
 * Creates an uncached JSON response.
 */
function json(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(body, {
    status,

    headers: {
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Returns true only for the public order types supported by the platform.
 */
function validOrderType(
  value: unknown,
): value is "dine_in" | "pickup" | "delivery" {
  return (
    value === "dine_in" ||
    value === "pickup" ||
    value === "delivery"
  );
}

/**
 * Validates and normalizes product lines before they reach Supabase.
 *
 * Pricing is intentionally NOT trusted from the browser.
 *
 * The client sends only identifiers and quantities. Authoritative prices,
 * stock, promotions, variants and add-ons must continue to be calculated
 * by the database RPC.
 */
function normalizeItems(
  items: OrderRequest["items"],
): NormalizedOrderItem[] | null {
  if (!Array.isArray(items) || items.length === 0) {
    return null;
  }

  if (items.length > MAX_ORDER_ITEMS) {
    return null;
  }

  const normalized: NormalizedOrderItem[] = [];

  for (const item of items) {
    const productId = item.productId?.trim() || "";

    if (!isValidUuid(productId)) {
      return null;
    }

    if (
      !Number.isInteger(item.quantity) ||
      Number(item.quantity) <= 0 ||
      Number(item.quantity) > 1_000
    ) {
      return null;
    }

    const variantId = item.variantId?.trim() || null;

    if (variantId && !isValidUuid(variantId)) {
      return null;
    }

    const rawAddons =
      Array.isArray(item.addons) ? item.addons : [];

    if (rawAddons.length > MAX_ADDONS_PER_ITEM) {
      return null;
    }

    const addons: Array<{ id: string }> = [];

    for (const addon of rawAddons) {
      const addonId = addon.id?.trim() || "";

      if (!isValidUuid(addonId)) {
        return null;
      }

      addons.push({
        id: addonId,
      });
    }

    normalized.push({
      product_id: productId,
      quantity: Number(item.quantity),
      variant_id: variantId,
      addons,
    });
  }

  return normalized;
}

/**
 * POST /api/public/orders
 *
 * Public storefront order creation.
 *
 * SECURITY FLOW:
 *
 * 1. Validate same-origin browser requests.
 * 2. Enforce request-body size.
 * 3. Reject honeypot submissions.
 * 4. Validate tenant/customer/product identifiers.
 * 5. Apply distributed rate limiting.
 * 6. Confirm that the tenant/storefront exists and is active.
 * 7. Send identifiers only to authoritative pricing/order RPCs.
 * 8. Return a small confirmation payload.
 */
export async function POST(
  request: Request,
): Promise<Response> {
  /* ========================================================================
     1. SAME-ORIGIN PROTECTION
     ======================================================================== */

  if (!requestHasAllowedOrigin(request)) {
    return json(
      {
        error: "Invalid request origin.",
      },
      403,
    );
  }

  try {
    /* ======================================================================
       2. READ BOUNDED JSON BODY
       ====================================================================== */

    const body =
      await readJsonBody<OrderRequest>(
        request,
      );

    /* ======================================================================
       3. HONEYPOT / SIMPLE BOT PROTECTION
       ====================================================================== */

    if (body.website?.trim()) {
      return json(
        {
          error: "Unable to place order.",
        },
        400,
      );
    }

    /* ======================================================================
       4. NORMALIZE CORE CUSTOMER/TENANT VALUES
       ====================================================================== */

    const tenantId =
      body.tenantId?.trim() || "";

    const customerName =
      body.customerName?.trim() || "";

    const email =
      body.customerEmail
        ?.trim()
        .toLowerCase() || "";

    const customerPhone =
      body.customerPhone?.trim() || "";

    if (!isValidUuid(tenantId)) {
      return json(
        {
          error: "Storefront was not found.",
        },
        400,
      );
    }

    if (
      customerName.length < 2 ||
      customerName.length > MAX_NAME_LENGTH
    ) {
      return json(
        {
          error: "Enter a valid customer name.",
        },
        400,
      );
    }

    if (!isValidEmail(email)) {
      return json(
        {
          error:
            "Enter a valid email address and try again.",
        },
        400,
      );
    }

    if (
      customerPhone.length > MAX_PHONE_LENGTH
    ) {
      return json(
        {
          error: "Enter a valid phone number.",
        },
        400,
      );
    }

    /* ======================================================================
       5. VALIDATE ORDER TYPE
       ====================================================================== */

    const orderType =
      body.orderType ?? "pickup";

    if (!validOrderType(orderType)) {
      return json(
        {
          error: "Select a valid order type.",
        },
        400,
      );
    }

    /* ======================================================================
       6. VALIDATE CART
       ====================================================================== */

    const items =
      normalizeItems(body.items);

    if (!items) {
      return json(
        {
          error:
            "Your cart contains invalid items.",
        },
        400,
      );
    }

    /* ======================================================================
       7. VALIDATE OPTIONAL CUSTOMER INPUT
       ====================================================================== */

    const deliveryAddress =
      body.deliveryAddress?.trim() || null;

    const deliveryArea =
      body.deliveryArea?.trim() || null;

    const deliveryInstructions =
      body.deliveryInstructions?.trim() ||
      null;

    const tableNumber =
      body.tableNumber?.trim() || null;

    const notes =
      body.notes?.trim() || null;

    const promotionCode =
      body.promotionCode?.trim() || null;

    if (
      deliveryAddress &&
      deliveryAddress.length >
        MAX_ADDRESS_LENGTH
    ) {
      return json(
        {
          error:
            "The delivery address is too long.",
        },
        400,
      );
    }

    if (
      deliveryInstructions &&
      deliveryInstructions.length >
        MAX_INSTRUCTIONS_LENGTH
    ) {
      return json(
        {
          error:
            "The delivery instructions are too long.",
        },
        400,
      );
    }

    if (
      notes &&
      notes.length > MAX_NOTES_LENGTH
    ) {
      return json(
        {
          error:
            "The order notes are too long.",
        },
        400,
      );
    }

    if (
      promotionCode &&
      promotionCode.length >
        MAX_PROMOTION_CODE_LENGTH
    ) {
      return json(
        {
          error:
            "The promotion code is invalid.",
        },
        400,
      );
    }

    if (
      tableNumber &&
      tableNumber.length >
        MAX_TABLE_NUMBER_LENGTH
    ) {
      return json(
        {
          error:
            "The table number is invalid.",
        },
        400,
      );
    }

    /**
     * Validate delivery-specific requirements before hitting Supabase.
     *
     * The authoritative database RPC should still repeat these checks.
     */
    if (
      orderType === "delivery" &&
      !deliveryAddress
    ) {
      return json(
        {
          error:
            "A delivery address is required.",
        },
        400,
      );
    }

    if (
      orderType === "dine_in" &&
      !tableNumber
    ) {
      return json(
        {
          error:
            "A table number is required.",
        },
        400,
      );
    }

    /* ======================================================================
       8. DISTRIBUTED RATE LIMIT
       ====================================================================== */

    const rate =
      await enforcePublicRateLimit(
        request,
        "order",
        tenantId,
        email,

        /**
         * Maximum five order attempts per customer fingerprint
         * within ten minutes.
         */
        5,
        600,
      );

    if (!rate.allowed) {
      return rateLimitResponse(
        rate.retryAfter,
      );
    }

    /* ======================================================================
       9. NORMALIZE PAYMENT MODE
       ====================================================================== */

    const paymentMethod =
      body.paymentMethod === "mock_card"
        ? "mock_card"
        : "pay_later";

    /* ======================================================================
       10. BUILD DATABASE RPC PAYLOAD

       IMPORTANT:
       Prices are intentionally absent here.

       Never trust client-supplied prices/totals for orders.
       ====================================================================== */

    const payload = {
      p_tenant_id: tenantId,

      p_customer_name:
        customerName,

      p_customer_email:
        email,

      p_customer_phone:
        customerPhone,

      p_order_type:
        orderType,

      p_items:
        items,

      p_requested_time:
        body.requestedTime?.trim() ||
        null,

      p_delivery_address:
        deliveryAddress,

      p_delivery_area:
        deliveryArea,

      p_delivery_instructions:
        deliveryInstructions,

      p_table_number:
        tableNumber,

      p_notes:
        notes,

      p_promotion_code:
        promotionCode,

      p_payment_method:
        paymentMethod,
    };

    /* ======================================================================
       11. INITIALIZE SERVER-ONLY SUPABASE CLIENT
       ====================================================================== */

    let supabase;

    try {
      supabase =
        getSupabaseAdminClient();
    } catch {
      return json(
        {
          error:
            "Online ordering is not configured.",
        },
        503,
      );
    }

    /* ======================================================================
       12. CONFIRM TENANT/STOREFRONT EXISTS

       This is not the final authorization/business-rule check. The order
       creation RPC remains responsible for enforcing current subscription,
       modules, catalog, inventory and pricing rules.
       ====================================================================== */

    const {
      data: tenant,
      error: tenantError,
    } = await supabase
      .from("tenants")
      .select(
        "business_type, is_active, status",
      )
      .eq("id", tenantId)
      .maybeSingle();

    if (
      tenantError ||
      !tenant
    ) {
      return json(
        {
          error:
            "Storefront was not found.",
        },
        404,
      );
    }

    if (
      !tenant.is_active ||
      tenant.status?.toUpperCase() !==
        "ACTIVE"
    ) {
      return json(
        {
          error:
            "This storefront is not currently accepting orders.",
        },
        403,
      );
    }

    /* ======================================================================
       13. CREATE ORDER

       Retail stores use their inventory-aware retail RPC.

       Ordering businesses use create_public_order_v3.
       ====================================================================== */

    let { data, error } =
      tenant.business_type === "retail"
        ? await supabase.rpc(
            "create_public_retail_order",
            {
              p_tenant_id:
                payload.p_tenant_id,

              p_customer_name:
                payload.p_customer_name,

              p_customer_email:
                payload.p_customer_email,

              p_customer_phone:
                payload.p_customer_phone,

              p_items:
                payload.p_items,

              p_notes:
                payload.p_notes,

              p_payment_method:
                payload.p_payment_method,
            },
          )
        : await supabase.rpc(
            "create_public_order_v3",
            payload,
          );

    /* ======================================================================
       14. ROLLING-DEPLOYMENT COMPATIBILITY

       PGRST202 means the newer RPC was not found in PostgREST's schema.

       Keep the older compatibility RPC available while databases are being
       migrated. It supports fewer fields than the v3 endpoint.
       ====================================================================== */

    if (error?.code === "PGRST202") {
      const fallback =
        await supabase.rpc(
          "create_public_order_with_email",
          {
            p_tenant_id:
              payload.p_tenant_id,

            p_customer_name:
              payload.p_customer_name,

            p_customer_email:
              payload.p_customer_email,

            p_customer_phone:
              payload.p_customer_phone,

            p_order_type:
              payload.p_order_type,

            p_items:
              payload.p_items,

            p_notes:
              payload.p_notes,

            p_promotion_code:
              payload.p_promotion_code,
          },
        );

      data = fallback.data;
      error = fallback.error;
    }

    /* ======================================================================
       15. HANDLE BUSINESS-RULE / DATABASE FAILURE
       ====================================================================== */

    if (error) {
      return json(
        {
          error: publicOperationError(
            error,
            "Unable to place order. Please try again.",
          ),
        },
        400,
      );
    }

    /* ======================================================================
       16. NORMALIZE RPC RESULT
       ====================================================================== */

    const result =
      Array.isArray(data)
        ? data[0]
        : data;

    if (!result?.order_id) {
      return json(
        {
          error:
            "The order was not confirmed.",
        },
        502,
      );
    }

    /* ======================================================================
       17. RETURN SAFE CONFIRMATION DATA

       Do not return internal tenant, customer, inventory, pricing-rule or
       Supabase information.
       ====================================================================== */

    return json({
      orderId:
        result.order_id,

      orderNumber:
        result.order_number,

      total:
        Number(result.total),

      paymentStatus:
        result.payment_status ||
        "UNPAID",

      paymentReference:
        result.payment_reference ||
        null,
    });
  } catch (error) {
    /* ======================================================================
       18. REQUEST PARSING FAILURE
       ====================================================================== */

    if (
      error instanceof Error &&
      error.message ===
        "REQUEST_TOO_LARGE"
    ) {
      return json(
        {
          error:
            "The order request is too large.",
        },
        413,
      );
    }

    if (
      error instanceof Error &&
      error.message === "INVALID_JSON"
    ) {
      return json(
        {
          error:
            "Invalid order request.",
        },
        400,
      );
    }

    /**
     * Public endpoints must not expose unexpected internal errors.
     */
    console.error(
      "[public-order] Unexpected request failure.",
      error,
    );

    return json(
      {
        error:
          "Invalid order request.",
      },
      400,
    );
  }
}
