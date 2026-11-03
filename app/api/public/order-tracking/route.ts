import { createHash, randomInt } from "node:crypto";
import { getSupabaseAdminClient } from "@/app/lib/supabase/admin";
import {
  createGuestAccessToken,
  hashGuestAccessToken,
} from "@/app/lib/server/guest-access";
import { getVerifiedTrackingSession } from "@/app/lib/server/order-tracking";
import {
  enforcePublicRateLimit,
  isValidEmail,
  isValidUuid,
  rateLimitResponse,
  readJsonBody,
  requestHasAllowedOrigin,
} from "@/app/lib/server/security";
import { sendTransactionalEmail } from "@/app/lib/email/resend";
import type { TrackedOrder } from "@/app/lib/order-tracking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TrackingRequest {
  action?: string;
  tenantId?: string;
  orderNumber?: string;
  accessToken?: string;
  code?: string;
}
function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function codeHash(token: string, code: string) {
  return createHash("sha256").update(`${token}:${code}`).digest("hex");
}

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request))
    return json({ error: "Invalid request origin." }, 403);
  try {
    const body = await readJsonBody<TrackingRequest>(request);
    const tenantId =
      typeof body.tenantId === "string" ? body.tenantId.trim() : "";
    const action = body.action;
    if (
      !isValidUuid(tenantId) ||
      !["request", "verify", "details"].includes(action ?? "")
    ) {
      return json({ error: "Invalid tracking request." }, 400);
    }
    const supabase = getSupabaseAdminClient();
    const { data: tenant, error: tenantError } = await supabase
      .from("tenants")
      .select("id,business_name,business_type,phone,address,is_active,status")
      .eq("id", tenantId)
      .maybeSingle();
    if (tenantError) throw tenantError;
    if (!tenant?.is_active || tenant.status?.toUpperCase() !== "ACTIVE")
      return json({ error: "Storefront unavailable." }, 404);

    if (action === "request") {
      const orderNumber =
        typeof body.orderNumber === "string"
          ? body.orderNumber.trim().toUpperCase()
          : "";
      if (!/^[A-Z0-9-]{4,50}$/.test(orderNumber))
        return json(
          {
            error:
              "Enter a valid order or appointment reference from your email.",
          },
          400,
        );
      // Limit all references per caller, plus an atomic per-order limit in SQL.
      const rate = await enforcePublicRateLimit(
        request,
        "tracking-code",
        tenantId,
        "",
        5,
        900,
      );
      if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
      const access = createGuestAccessToken();
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const [orderLookup, appointmentLookup] = await Promise.all([
        supabase
          .from("orders")
          .select("id,order_number,customer_email,customer_name")
          .eq("tenant_id", tenantId)
          .eq("order_number", orderNumber)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select(
            "id,appointment_number,customer_email,customer_name,payment_method",
          )
          .eq("tenant_id", tenantId)
          .eq("appointment_number", orderNumber)
          .eq("payment_method", "bank_transfer")
          .maybeSingle(),
      ]);
      if (orderLookup.error || appointmentLookup.error)
        throw orderLookup.error ?? appointmentLookup.error;
      const target = orderLookup.data ?? appointmentLookup.data;
      const targetKind = orderLookup.data ? "order" : "booking";
      if (target && isValidEmail(target.customer_email ?? "")) {
        const challenge = orderLookup.data
          ? await supabase.rpc("request_order_tracking_code", {
              p_tenant_id: tenantId,
              p_order_id: target.id,
              p_token_hash: access.hash,
              p_code_hash: codeHash(access.token, code),
            })
          : await supabase.rpc("request_appointment_tracking_code", {
              p_tenant_id: tenantId,
              p_appointment_id: target.id,
              p_token_hash: access.hash,
              p_code_hash: codeHash(access.token, code),
            });
        if (challenge.error) throw challenge.error;
        if (challenge.data) {
          try {
            await sendTransactionalEmail({
              eventType: "ORDER_TRACKING_CODE",
              to: target.customer_email,
              recipientName: target.customer_name,
              idempotencyKey: `tracking-${challenge.data}`,
              payload: {
                business_name: tenant.business_name,
                order_number: orderNumber,
                reference: orderNumber,
                record_label: targetKind,
                verification_code: code,
              },
            });
          } catch {
            // Keep the response identical for unknown references and delivery failures.
            console.error(
              "[order-tracking] Verification email could not be sent.",
            );
            await supabase
              .from("order_tracking_sessions")
              .update({ code_hash: null })
              .eq("id", challenge.data);
          }
        }
      }
      // Do not expose whether a reference exists, its email, or any items yet.
      return json({
        accessToken: access.token,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
        resendAfter: 60,
      });
    }

    const token = typeof body.accessToken === "string" ? body.accessToken : "";
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      return json(
        { error: "Verify your email to view this transaction." },
        401,
      );
    if (action === "verify") {
      const code = typeof body.code === "string" ? body.code : "";
      if (!/^\d{6}$/.test(code))
        return json(
          { error: "Enter the six-digit code from your email." },
          400,
        );
      const rate = await enforcePublicRateLimit(
        request,
        "tracking-verify",
        tenantId,
        "",
        12,
        600,
      );
      if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
      const verified = await supabase.rpc("verify_order_tracking_code", {
        p_tenant_id: tenantId,
        p_token_hash: hashGuestAccessToken(token),
        p_code_hash: codeHash(token, code),
      });
      if (verified.error) throw verified.error;
      if (!verified.data)
        return json(
          {
            error:
              "The code is incorrect, expired, or has reached its attempt limit. Request a new code.",
          },
          403,
        );
    }
    const session = await getVerifiedTrackingSession(tenantId, token);
    if (!session)
      return json(
        {
          error:
            "Your tracking session has expired. Please verify your email again.",
        },
        401,
      );
    if (session.appointment_id) {
      const { data: appointment, error: appointmentError } = await supabase
        .from("appointments")
        .select(
          "id,appointment_number,customer_email,created_at,status,payment_status,payment_method,subtotal,total,amount_paid,deposit_required,outstanding_balance,starts_at,notes,payment_reservation_expires_at",
        )
        .eq("tenant_id", tenantId)
        .eq("id", session.appointment_id)
        .maybeSingle();
      if (appointmentError) throw appointmentError;
      if (
        !appointment ||
        appointment.customer_email?.toLowerCase() !== session.customer_email
      ) {
        return json({ error: "Please verify this appointment again." }, 401);
      }

      const [services, receipts, method, accounts] = await Promise.all([
        supabase
          .from("appointment_services")
          .select("id,service_name,price")
          .eq("tenant_id", tenantId)
          .eq("appointment_id", appointment.id)
          .order("created_at"),
        supabase
          .from("customer_payment_submissions")
          .select(
            "id,status,submitted_amount,created_at,verified_at,transaction_reference,rejection_reason,receipt_path,receipt_mime_type",
          )
          .eq("tenant_id", tenantId)
          .eq("appointment_id", appointment.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("business_payment_methods")
          .select("method,instructions,external_url")
          .eq("tenant_id", tenantId)
          .eq("method", appointment.payment_method)
          .eq("enabled", true)
          .contains("modules", ["appointment"])
          .maybeSingle(),
        supabase
          .from("business_bank_accounts")
          .select(
            "id,label,bank_name,account_holder,account_number,currency,instructions",
          )
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("sort_order"),
      ]);
      for (const query of [services, receipts, method, accounts]) {
        if (query.error) throw query.error;
      }
      const receipt = receipts.data;
      let receiptUrl: string | null = null;
      if (
        receipt?.receipt_path?.startsWith(
          `${tenantId}/appointment/${appointment.id}/`,
        )
      ) {
        const signed = await supabase.storage
          .from("payment-receipts")
          .createSignedUrl(receipt.receipt_path, 300);
        receiptUrl = signed.data?.signedUrl ?? null;
      }
      const closed =
        ["CANCELLED", "CANCELED"].includes(
          String(appointment.status).toUpperCase(),
        ) ||
        ["PAID", "REFUNDED", "CANCELLED", "CANCELED"].includes(
          String(appointment.payment_status).toUpperCase(),
        );
      const amountPaid = Number(appointment.amount_paid ?? 0);
      const total = Number(appointment.total ?? 0);
      const paymentStatus = String(
        appointment.payment_status ?? "UNPAID",
      ).toUpperCase();
      const result: TrackedOrder = {
        kind: "appointment",
        id: appointment.id,
        orderNumber:
          appointment.appointment_number ??
          `AP-${appointment.id.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
        customerEmail: appointment.customer_email,
        createdAt: appointment.created_at,
        status: String(appointment.status ?? "PENDING").toUpperCase(),
        paymentStatus,
        paymentMethod:
          method.data?.method ??
          appointment.payment_method ??
          "payment_at_appointment",
        orderType: "appointment",
        subtotal: Number(appointment.subtotal ?? total),
        tax: 0,
        deliveryFee: 0,
        discount: Math.max(0, Number(appointment.subtotal ?? total) - total),
        total,
        amountPaid,
        paymentDue: Math.max(
          0,
          paymentStatus === "PARTIALLY_PAID" || paymentStatus === "PARTIAL"
            ? total - amountPaid
            : Number(
                appointment.outstanding_balance ??
                  appointment.deposit_required ??
                  total - amountPaid,
              ),
        ),
        deliveryAddress: "",
        instructions: appointment.notes ?? "",
        requestedTime: appointment.starts_at,
        reservationExpiresAt: appointment.payment_reservation_expires_at,
        canUploadReceipt:
          appointment.payment_method === "bank_transfer" &&
          !closed &&
          receipt?.status !== "AWAITING_VERIFICATION",
        items: (services.data ?? []).map((service) => ({
          id: service.id,
          name: service.service_name,
          image: "",
          quantity: 1,
          unitPrice: Number(service.price ?? 0),
          subtotal: Number(service.price ?? 0),
          sku: "",
          addons: [],
        })),
        history: [
          { status: appointment.status, createdAt: appointment.created_at },
        ],
        receipt: receipt
          ? {
              id: receipt.id,
              status: receipt.status,
              amount: Number(receipt.submitted_amount),
              createdAt: receipt.created_at,
              verifiedAt: receipt.verified_at,
              reference: receipt.transaction_reference ?? "",
              reason: receipt.rejection_reason ?? "",
              url: receiptUrl,
              mimeType: receipt.receipt_mime_type,
            }
          : null,
        business: {
          name: tenant.business_name,
          phone: tenant.phone ?? "",
          pickupLocation: tenant.address ?? "",
          pickupInstructions: "",
          deliveryNotes: "",
        },
        payment: {
          instructions: method.data?.instructions ?? "",
          externalUrl: method.data?.external_url?.startsWith("https://")
            ? method.data.external_url
            : null,
          bankAccounts:
            appointment.payment_method === "bank_transfer"
              ? (accounts.data ?? []).map((account) => ({
                  id: account.id,
                  label: account.label || account.bank_name,
                  bankName: account.bank_name,
                  accountHolder: account.account_holder,
                  accountNumber: account.account_number,
                  currency: account.currency,
                  instructions: account.instructions ?? "",
                }))
              : [],
        },
      };
      return json({ order: result, expiresAt: session.expires_at });
    }
    if (!session.order_id)
      return json({ error: "Please verify this transaction again." }, 401);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        "id,order_number,customer_email,created_at,status,payment_status,payment_method,order_type,subtotal,tax_amount,delivery_fee,discount_amount,promotion_discount_amount,total,amount_paid,delivery_address,delivery_instructions,requested_time,inventory_reservation_status,inventory_reservation_expires_at",
      )
      .eq("tenant_id", tenantId)
      .eq("id", session.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (
      !order ||
      order.customer_email?.toLowerCase() !== session.customer_email
    )
      return json({ error: "Please verify this transaction again." }, 401);
    const [items, history, receipts, fulfillment, method, accounts] =
      await Promise.all([
        supabase
          .from("order_items")
          .select(
            "id,product_name,quantity,unit_price,subtotal,sku,addons,products(image_url)",
          )
          .eq("tenant_id", tenantId)
          .eq("order_id", order.id)
          .order("created_at"),
        supabase
          .from("order_status_history")
          .select("new_status,created_at")
          .eq("tenant_id", tenantId)
          .eq("order_id", order.id)
          .order("created_at"),
        supabase
          .from("customer_payment_submissions")
          .select(
            "id,status,submitted_amount,created_at,verified_at,transaction_reference,rejection_reason,receipt_path,receipt_mime_type",
          )
          .eq("tenant_id", tenantId)
          .eq("order_id", order.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("business_fulfillment_settings")
          .select("pickup_location,pickup_instructions,delivery_notes")
          .eq("tenant_id", tenantId)
          .maybeSingle(),
        supabase
          .from("business_payment_methods")
          .select("method,instructions,external_url")
          .eq("tenant_id", tenantId)
          .eq(
            "method",
            !order.payment_method || order.payment_method === "pay_later"
              ? "bank_transfer"
              : order.payment_method,
          )
          .eq("enabled", true)
          .contains("modules", [
            tenant.business_type === "retail" ? "retail" : "ordering",
          ])
          .maybeSingle(),
        supabase
          .from("business_bank_accounts")
          .select(
            "id,label,bank_name,account_holder,account_number,currency,instructions",
          )
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .order("sort_order"),
      ]);
    for (const result of [items, receipts, fulfillment, method, accounts]) {
      if (result.error) throw result.error;
    }
    // Status history enriches the delivery timeline, but older installations
    // can legitimately lack this table. Do not block a verified customer from
    // seeing the rest of their order while the forward repair migration is
    // being applied. Every other history error remains fatal.
    if (
      history.error &&
      !(
        history.error.code === "PGRST205" &&
        history.error.message.includes("order_status_history")
      )
    ) {
      throw history.error;
    }
    const receipt = receipts.data;
    let receiptUrl: string | null = null;
    if (receipt?.receipt_path?.startsWith(`${tenantId}/order/${order.id}/`)) {
      const signed = await supabase.storage
        .from("payment-receipts")
        .createSignedUrl(receipt.receipt_path, 300);
      receiptUrl = signed.data?.signedUrl ?? null;
    }
    const closed =
      ["CANCELLED", "CANCELED"].includes(String(order.status).toUpperCase()) ||
      ["PAID", "REFUNDED", "CANCELED", "CANCELLED"].includes(
        String(order.payment_status).toUpperCase(),
      ) ||
      ["EXPIRED", "CANCELLED"].includes(order.inventory_reservation_status) ||
      (order.inventory_reservation_expires_at &&
        Date.parse(order.inventory_reservation_expires_at) <= Date.now());
    const result: TrackedOrder = {
      kind: "order",
      id: order.id,
      orderNumber: order.order_number,
      customerEmail: order.customer_email,
      createdAt: order.created_at,
      status: String(order.status ?? "PENDING").toUpperCase(),
      paymentStatus: String(order.payment_status ?? "UNPAID").toUpperCase(),
      paymentMethod: method.data?.method ?? order.payment_method ?? "pay_later",
      orderType: order.order_type ?? "pickup",
      subtotal: Number(order.subtotal),
      tax: Number(order.tax_amount),
      deliveryFee: Number(order.delivery_fee),
      discount:
        Number(order.discount_amount ?? 0) +
        Number(order.promotion_discount_amount ?? 0),
      total: Number(order.total),
      amountPaid: Number(order.amount_paid ?? 0),
      paymentDue: Math.max(
        0,
        Number(order.total ?? 0) - Number(order.amount_paid ?? 0),
      ),
      deliveryAddress: order.delivery_address ?? "",
      instructions: order.delivery_instructions ?? "",
      requestedTime: order.requested_time,
      reservationExpiresAt: order.inventory_reservation_expires_at,
      canUploadReceipt:
        (order.payment_method === "bank_transfer" ||
          method.data?.method === "bank_transfer") &&
        !closed &&
        !["AWAITING_VERIFICATION", "VERIFIED"].includes(receipt?.status ?? ""),
      items: (items.data ?? []).map((item) => {
        const product = (
          Array.isArray(item.products) ? item.products[0] : item.products
        ) as { image_url?: string } | null;
        return {
          id: item.id,
          name: item.product_name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal),
          sku: item.sku ?? "",
          image: product?.image_url ?? "",
          addons: Array.isArray(item.addons)
            ? item.addons.filter(
                (addon: unknown): addon is { name: string; price: number } =>
                  typeof addon === "object" &&
                  addon !== null &&
                  "name" in addon &&
                  typeof addon.name === "string" &&
                  "price" in addon &&
                  typeof addon.price === "number",
              )
            : [],
        };
      }),
      history: (history.data ?? []).map((event) => ({
        status: event.new_status,
        createdAt: event.created_at,
      })),
      receipt: receipt
        ? {
            id: receipt.id,
            status: receipt.status,
            amount: Number(receipt.submitted_amount),
            createdAt: receipt.created_at,
            verifiedAt: receipt.verified_at,
            reference: receipt.transaction_reference ?? "",
            reason: receipt.rejection_reason ?? "",
            url: receiptUrl,
            mimeType: receipt.receipt_mime_type,
          }
        : null,
      business: {
        name: tenant.business_name,
        phone: tenant.phone ?? "",
        pickupLocation:
          fulfillment.data?.pickup_location || tenant.address || "",
        pickupInstructions: fulfillment.data?.pickup_instructions ?? "",
        deliveryNotes: fulfillment.data?.delivery_notes ?? "",
      },
      payment: {
        instructions: method.data?.instructions ?? "",
        externalUrl: method.data?.external_url?.startsWith("https://")
          ? method.data.external_url
          : null,
        bankAccounts:
          order.payment_method === "bank_transfer" ||
          method.data?.method === "bank_transfer"
            ? (accounts.data ?? []).map((account) => ({
                id: account.id,
                label: account.label || account.bank_name,
                bankName: account.bank_name,
                accountHolder: account.account_holder,
                accountNumber: account.account_number,
                currency: account.currency,
                instructions: account.instructions ?? "",
              }))
            : [],
      },
    };
    return json({ order: result, expiresAt: session.expires_at });
  } catch {
    console.error("[order-tracking] Tracking request failed.");
    return json(
      {
        error:
          "Order and appointment tracking is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  }
}
