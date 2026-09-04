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

interface OrderRequest {
  tenantId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderType?: "dine_in" | "pickup" | "delivery";
  items?: Array<{
    productId?: string;
    quantity?: number;
    addons?: Array<{ id?: string }>;
  }>;
  requestedTime?: string;
  deliveryAddress?: string;
  deliveryArea?: string;
  deliveryInstructions?: string;
  tableNumber?: string;
  notes?: string;
  promotionCode?: string;
  paymentMethod?: "pay_later" | "mock_card";
  website?: string;
}

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await readJsonBody<OrderRequest>(request);
    const tenantId = body.tenantId?.trim() || "";
    const email = body.customerEmail?.trim().toLowerCase() || "";
    if (body.website)
      return Response.json(
        { error: "Unable to place order." },
        { status: 400 },
      );
    if (!isValidUuid(tenantId) || !isValidEmail(email)) {
      return Response.json(
        { error: "Enter a valid email address and try again." },
        { status: 400 },
      );
    }
    const rate = await enforcePublicRateLimit(
      request,
      "order",
      tenantId,
      email,
      5,
      600,
    );
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    const items = Array.isArray(body.items)
      ? body.items.slice(0, 100).map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          addons: (item.addons || [])
            .slice(0, 30)
            .map((addon) => ({ id: addon.id })),
        }))
      : [];
    const payload = {
      p_tenant_id: tenantId,
      p_customer_name: body.customerName?.trim() || "",
      p_customer_email: email,
      p_customer_phone: body.customerPhone?.trim() || "",
      p_order_type: body.orderType || "pickup",
      p_items: items,
      p_requested_time: body.requestedTime || null,
      p_delivery_address: body.deliveryAddress?.trim() || null,
      p_delivery_area: body.deliveryArea?.trim() || null,
      p_delivery_instructions: body.deliveryInstructions?.trim() || null,
      p_table_number: body.tableNumber?.trim() || null,
      p_notes: body.notes?.trim() || null,
      p_promotion_code: body.promotionCode?.trim() || null,
      p_payment_method:
        body.paymentMethod === "mock_card" ? "mock_card" : "pay_later",
    };
    let supabase;
    try {
      supabase = getSupabaseAdminClient();
    } catch {
      return Response.json(
        { error: "Online ordering is not configured." },
        { status: 503 },
      );
    }
    let { data, error } = await supabase.rpc("create_public_order_v3", payload);
    if (error?.code === "PGRST202") {
      const fallback = await supabase.rpc("create_public_order_with_email", {
        p_tenant_id: payload.p_tenant_id,
        p_customer_name: payload.p_customer_name,
        p_customer_email: payload.p_customer_email,
        p_customer_phone: payload.p_customer_phone,
        p_order_type: payload.p_order_type,
        p_items: payload.p_items,
        p_notes: payload.p_notes,
        p_promotion_code: payload.p_promotion_code,
      });
      data = fallback.data;
      error = fallback.error;
    }
    if (error)
      return Response.json(
        {
          error: publicOperationError(
            error,
            "Unable to place order. Please try again.",
          ),
        },
        { status: 400 },
      );
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.order_id)
      return Response.json(
        { error: "The order was not confirmed." },
        { status: 502 },
      );
    return Response.json({
      orderId: result.order_id,
      orderNumber: result.order_number,
      total: Number(result.total),
      paymentStatus: result.payment_status || "UNPAID",
      paymentReference: result.payment_reference || null,
    });
  } catch (error) {
    const status =
      error instanceof Error && error.message === "REQUEST_TOO_LARGE"
        ? 413
        : 400;
    return Response.json(
      {
        error:
          status === 413
            ? "The order request is too large."
            : "Invalid order request.",
      },
      { status },
    );
  }
}
