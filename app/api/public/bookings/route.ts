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

const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 40;
const MAX_NOTES_LENGTH = 2_000;
const MAX_PROMOTION_CODE_LENGTH = 100;

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

  /**
   * Honeypot field.
   * Real users should never populate this value.
   */
  website?: string;
}

/**
 * Return public API responses without allowing intermediary/browser caching.
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
 * Accept YYYY-MM-DD only.
 *
 * The database RPC remains responsible for deciding whether the date is
 * actually available, in the future and within the business schedule.
 */
function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value
    .split("-")
    .map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day),
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Accept HH:MM or HH:MM:SS using a 24-hour clock.
 *
 * Availability and business-hour enforcement remain authoritative in
 * Supabase.
 */
function isValidTime(value: string) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(
    value,
  );
}

/**
 * POST /api/public/bookings
 *
 * Public storefront appointment creation.
 *
 * Security flow:
 * 1. Check browser Origin when present.
 * 2. Read a bounded JSON body.
 * 3. Reject honeypot submissions.
 * 4. Validate tenant/service/provider identifiers.
 * 5. Validate customer-controlled input.
 * 6. Apply the distributed public rate limiter.
 * 7. Send normalized values to the authoritative booking RPC.
 */
export async function POST(
  request: Request,
): Promise<Response> {
  if (!requestHasAllowedOrigin(request)) {
    return json(
      {
        error: "Invalid request origin.",
      },
      403,
    );
  }

  try {
    /* ----------------------------------------------------------------------
       Read and normalize public input
       ---------------------------------------------------------------------- */

    const body =
      await readJsonBody<BookingRequest>(
        request,
        16_384,
      );

    /**
     * Honeypot protection.
     */
    if (body.website?.trim()) {
      return json(
        {
          error:
            "Unable to create appointment.",
        },
        400,
      );
    }

    const tenantId =
      body.tenantId?.trim() || "";

    const serviceId =
      body.serviceId?.trim() || "";

    const providerId =
      body.providerId?.trim() || null;

    const appointmentDate =
      body.date?.trim() || "";

    const appointmentTime =
      body.time?.trim() || "";

    const customerName =
      body.customerName?.trim() || "";

    const email =
      body.customerEmail
        ?.trim()
        .toLowerCase() || "";

    const customerPhone =
      body.customerPhone?.trim() || "";

    const notes =
      body.notes?.trim() || null;

    const promotionCode =
      body.promotionCode?.trim() || null;

    /* ----------------------------------------------------------------------
       Validate tenant/resource identifiers
       ---------------------------------------------------------------------- */

    if (
      !isValidUuid(tenantId) ||
      !isValidUuid(serviceId) ||
      (providerId &&
        !isValidUuid(providerId))
    ) {
      return json(
        {
          error:
            "Invalid appointment request.",
        },
        400,
      );
    }

    /* ----------------------------------------------------------------------
       Validate customer identity fields
       ---------------------------------------------------------------------- */

    if (
      customerName.length < 2 ||
      customerName.length >
        MAX_NAME_LENGTH
    ) {
      return json(
        {
          error:
            "Enter a valid customer name.",
        },
        400,
      );
    }

    if (!isValidEmail(email)) {
      return json(
        {
          error:
            "Enter a valid email address.",
        },
        400,
      );
    }

    if (
      customerPhone.length >
      MAX_PHONE_LENGTH
    ) {
      return json(
        {
          error:
            "Enter a valid phone number.",
        },
        400,
      );
    }

    /* ----------------------------------------------------------------------
       Validate appointment date/time syntax

       IMPORTANT:
       Do not compare the submitted date/time against the server's local
       timezone here. Businesses may operate in a different timezone.

       Supabase remains responsible for:
       - future-date enforcement
       - business hours
       - employee/provider availability
       - overlapping appointments
       - duplicate appointments
       ---------------------------------------------------------------------- */

    if (
      !isValidDate(appointmentDate) ||
      !isValidTime(appointmentTime)
    ) {
      return json(
        {
          error:
            "Select a valid appointment date and time.",
        },
        400,
      );
    }

    /* ----------------------------------------------------------------------
       Bound free-form public input
       ---------------------------------------------------------------------- */

    if (
      notes &&
      notes.length > MAX_NOTES_LENGTH
    ) {
      return json(
        {
          error:
            "Appointment notes are too long.",
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

    /* ----------------------------------------------------------------------
       Distributed rate limiting

       Four booking attempts per tenant/customer fingerprint every ten
       minutes.
       ---------------------------------------------------------------------- */

    const rate =
      await enforcePublicRateLimit(
        request,
        "booking",
        tenantId,
        email,
        4,
        600,
      );

    if (!rate.allowed) {
      return rateLimitResponse(
        rate.retryAfter,
      );
    }

    /* ----------------------------------------------------------------------
       Initialize the trusted Supabase server client.
       ---------------------------------------------------------------------- */

    let supabase;

    try {
      supabase =
        getSupabaseAdminClient();
    } catch {
      return json(
        {
          error:
            "Online booking is not configured.",
        },
        503,
      );
    }

    /* ----------------------------------------------------------------------
       Build authoritative RPC input.

       Price, availability, provider membership, promotion value and payment
       totals must NOT be trusted from the browser.
       ---------------------------------------------------------------------- */

    const payload = {
      p_tenant_id: tenantId,
      p_service_id: serviceId,

      p_appointment_date:
        appointmentDate,

      p_appointment_time:
        appointmentTime,

      p_customer_name:
        customerName,

      p_customer_email:
        email,

      p_customer_phone:
        customerPhone,

      p_notes:
        notes,

      p_staff_id:
        providerId,

      p_promotion_code:
        promotionCode,

      /**
       * Real payment-provider methods are intentionally deferred.
       */
      p_payment_method:
        body.paymentMethod === "mock_card"
          ? "mock_card"
          : "pay_later",
    };

    /* ----------------------------------------------------------------------
       Create appointment using the newest payment-aware RPC.
       ---------------------------------------------------------------------- */

    let { data, error } =
      await supabase.rpc(
        "create_public_appointment_with_payment",
        payload,
      );

    /* ----------------------------------------------------------------------
       Rolling database compatibility.

       PGRST202 indicates that PostgREST could not find the newer RPC.

       Keep the older provider-aware function temporarily while staged
       migrations are being applied across environments.
       ---------------------------------------------------------------------- */

    if (error?.code === "PGRST202") {
      const fallback =
        await supabase.rpc(
          "create_public_appointment_with_provider",
          {
            p_tenant_id:
              payload.p_tenant_id,

            p_service_id:
              payload.p_service_id,

            p_appointment_date:
              payload.p_appointment_date,

            p_appointment_time:
              payload.p_appointment_time,

            p_customer_name:
              payload.p_customer_name,

            p_customer_email:
              payload.p_customer_email,

            p_customer_phone:
              payload.p_customer_phone,

            p_notes:
              payload.p_notes,

            p_staff_id:
              payload.p_staff_id,

            p_promotion_code:
              payload.p_promotion_code,
          },
        );

      data = fallback.data;
      error = fallback.error;
    }

    /* ----------------------------------------------------------------------
       Convert known business-rule errors into safe customer-facing messages.
       ---------------------------------------------------------------------- */

    if (error) {
      return json(
        {
          error: publicOperationError(
            error,
            "Unable to create the appointment. Please try again.",
          ),
        },
        400,
      );
    }

    /* ----------------------------------------------------------------------
       Normalize RPC response.

       Older RPCs may return only an appointment UUID while newer RPCs return
       payment information as well.
       ---------------------------------------------------------------------- */

    const result =
      typeof data === "string"
        ? {
            appointment_id: data,
            payment_status: "UNPAID",
          }
        : Array.isArray(data)
          ? data[0]
          : data;

    if (!result?.appointment_id) {
      return json(
        {
          error:
            "The appointment was not confirmed.",
        },
        502,
      );
    }

    /* ----------------------------------------------------------------------
       Return only the information required by the storefront.
       ---------------------------------------------------------------------- */

    return json({
      appointmentId:
        result.appointment_id,

      paymentStatus:
        result.payment_status ||
        "UNPAID",

      paymentReference:
        result.payment_reference ||
        null,
    });
  } catch (error) {
    /* ----------------------------------------------------------------------
       Request parsing errors
       ---------------------------------------------------------------------- */

    if (
      error instanceof Error &&
      error.message ===
        "REQUEST_TOO_LARGE"
    ) {
      return json(
        {
          error:
            "The booking request is too large.",
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
            "Invalid booking request.",
        },
        400,
      );
    }

    console.error(
      "[public-booking] Unexpected request failure.",
      error,
    );

    return json(
      {
        error:
          "Invalid booking request.",
      },
      400,
    );
  }
}
