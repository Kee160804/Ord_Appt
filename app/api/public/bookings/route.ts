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

interface BookingRequest {
  tenantId?: string;
  serviceId?: string;
  date?: string;
  time?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  notes?: string;
  providerId?: string;
  promotionCode?: string;
  paymentMethod?: "pay_later" | "mock_card";
  website?: string;
}

export async function POST(request: Request) {
  if (!requestHasAllowedOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const body = await readJsonBody<BookingRequest>(request, 16_384);
    const tenantId = body.tenantId?.trim() || "";
    const serviceId = body.serviceId?.trim() || "";
    const email = body.customerEmail?.trim().toLowerCase() || "";
    if (body.website)
      return Response.json(
        { error: "Unable to create appointment." },
        { status: 400 },
      );
    if (
      !isValidUuid(tenantId) ||
      !isValidUuid(serviceId) ||
      !isValidEmail(email) ||
      (body.providerId && !isValidUuid(body.providerId))
    ) {
      return Response.json(
        { error: "Invalid appointment request." },
        { status: 400 },
      );
    }
    const rate = await enforcePublicRateLimit(
      request,
      "booking",
      tenantId,
      email,
      4,
      600,
    );
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter);
    let supabase;
    try {
      supabase = getSupabaseAdminClient();
    } catch {
      return Response.json(
        { error: "Online booking is not configured." },
        { status: 503 },
      );
    }
    const payload = {
      p_tenant_id: tenantId,
      p_service_id: serviceId,
      p_appointment_date: body.date,
      p_appointment_time: body.time,
      p_customer_name: body.customerName?.trim() || "",
      p_customer_email: email,
      p_customer_phone: body.customerPhone?.trim() || "",
      p_notes: body.notes?.trim() || null,
      p_staff_id: body.providerId || null,
      p_promotion_code: body.promotionCode?.trim() || null,
      p_payment_method:
        body.paymentMethod === "mock_card" ? "mock_card" : "pay_later",
    };
    let { data, error } = await supabase.rpc(
      "create_public_appointment_with_payment",
      payload,
    );
    if (error?.code === "PGRST202") {
      const fallback = await supabase.rpc(
        "create_public_appointment_with_provider",
        {
          p_tenant_id: payload.p_tenant_id,
          p_service_id: payload.p_service_id,
          p_appointment_date: payload.p_appointment_date,
          p_appointment_time: payload.p_appointment_time,
          p_customer_name: payload.p_customer_name,
          p_customer_email: payload.p_customer_email,
          p_customer_phone: payload.p_customer_phone,
          p_notes: payload.p_notes,
          p_staff_id: payload.p_staff_id,
          p_promotion_code: payload.p_promotion_code,
        },
      );
      data = fallback.data;
      error = fallback.error;
    }
    if (error)
      return Response.json(
        {
          error: publicOperationError(
            error,
            "Unable to create the appointment. Please try again.",
          ),
        },
        { status: 400 },
      );
    const result =
      typeof data === "string"
        ? { appointment_id: data, payment_status: "UNPAID" }
        : Array.isArray(data)
          ? data[0]
          : data;
    if (!result?.appointment_id)
      return Response.json(
        { error: "The appointment was not confirmed." },
        { status: 502 },
      );
    return Response.json({
      appointmentId: result.appointment_id,
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
            ? "The booking request is too large."
            : "Invalid booking request.",
      },
      { status },
    );
  }
}
