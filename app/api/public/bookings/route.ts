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
import { isValidPromotionCode } from "@/app/lib/promotions";
import {
  isBusinessPaymentMethod,
  type BusinessPaymentMethod,
} from "@/app/lib/business-payments";
import { createGuestAccessToken } from "@/app/lib/server/guest-access";
import { processEmailQueueBestEffort } from "@/app/lib/email/process-best-effort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME_LENGTH = 120;
const MAX_PHONE_LENGTH = 40;
const MAX_NOTES_LENGTH = 2_000;

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

  paymentMethod?: BusinessPaymentMethod;
  paymentOption?: "deposit" | "full";

  /**
   * Honeypot field.
   * Real users should never populate this value.
   */
  website?: string;
}

/**
 * Return public API responses without allowing intermediary/browser caching.
 */
function json(body: Record<string, unknown>, status = 200): Response {
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

  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day));

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
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
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
export async function POST(request: Request): Promise<Response> {
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

    const body = await readJsonBody<BookingRequest>(request, 16_384);

    /**
     * Honeypot protection.
     */
    if (body.website?.trim()) {
      return json(
        {
          error: "Unable to create appointment.",
        },
        400,
      );
    }

    const tenantId = body.tenantId?.trim() || "";

    const serviceId = body.serviceId?.trim() || "";

    const providerId = body.providerId?.trim() || null;

    const appointmentDate = body.date?.trim() || "";

    const appointmentTime = body.time?.trim() || "";

    const customerName = body.customerName?.trim() || "";

    const email = body.customerEmail?.trim().toLowerCase() || "";

    const customerPhone = body.customerPhone?.trim() || "";

    const notes = body.notes?.trim() || null;

    const promotionCode = body.promotionCode?.trim().toUpperCase() || null;

    const paymentMethod = body.paymentMethod?.trim() || "";

    const paymentOption = body.paymentOption?.trim().toLowerCase() || "deposit";

    /* ----------------------------------------------------------------------
       Validate tenant/resource identifiers
       ---------------------------------------------------------------------- */

    if (
      !isValidUuid(tenantId) ||
      !isValidUuid(serviceId) ||
      (providerId && !isValidUuid(providerId))
    ) {
      return json(
        {
          error: "Invalid appointment request.",
        },
        400,
      );
    }

    /* ----------------------------------------------------------------------
       Validate customer identity fields
       ---------------------------------------------------------------------- */

    if (customerName.length < 2 || customerName.length > MAX_NAME_LENGTH) {
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
          error: "Enter a valid email address.",
        },
        400,
      );
    }

    if (customerPhone.length > MAX_PHONE_LENGTH) {
      return json(
        {
          error: "Enter a valid phone number.",
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

    if (!isValidDate(appointmentDate) || !isValidTime(appointmentTime)) {
      return json(
        {
          error: "Select a valid appointment date and time.",
        },
        400,
      );
    }

    /* ----------------------------------------------------------------------
       Bound free-form public input
       ---------------------------------------------------------------------- */

    if (notes && notes.length > MAX_NOTES_LENGTH) {
      return json(
        {
          error: "Appointment notes are too long.",
        },
        400,
      );
    }

    if (promotionCode && !isValidPromotionCode(promotionCode)) {
      return json(
        {
          error: "The promotion code is invalid.",
        },
        400,
      );
    }

    if (
      !isBusinessPaymentMethod(paymentMethod) ||
      !["bank_transfer", "payment_at_appointment", "external_link"].includes(
        paymentMethod,
      )
    ) {
      return json(
        {
          error: "Choose an available business payment method.",
        },
        400,
      );
    }

    if (paymentOption !== "deposit" && paymentOption !== "full") {
      return json(
        {
          error: "Choose whether to pay the deposit or the full amount.",
        },
        400,
      );
    }

    /* ----------------------------------------------------------------------
       Distributed rate limiting

       Four booking attempts per tenant/customer fingerprint every ten
       minutes.
       ---------------------------------------------------------------------- */

    const rate = await enforcePublicRateLimit(
      request,
      "booking",
      tenantId,
      email,
      4,
      600,
    );

    if (!rate.allowed) {
      return rateLimitResponse(rate.retryAfter);
    }

    /* ----------------------------------------------------------------------
       Initialize the trusted Supabase server client.
       ---------------------------------------------------------------------- */

    let supabase;

    try {
      supabase = getSupabaseAdminClient();
    } catch {
      return json(
        {
          error: "Online booking is not configured.",
        },
        503,
      );
    }

    if (paymentMethod === "bank_transfer") {
      const { data: activeBankAccount, error: bankAccountError } =
        await supabase
          .from("business_bank_accounts")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
      if (bankAccountError) {
        console.error("[public-booking] Bank availability check failed.", {
          code: bankAccountError.code,
        });
        return json(
          { error: "Business payment details are temporarily unavailable." },
          503,
        );
      }
      if (!activeBankAccount) {
        return json(
          {
            error:
              "Bank transfer is not available because this business has not added an active bank account. Choose pay deposit in person or contact the business.",
          },
          409,
        );
      }
    }

    /* ----------------------------------------------------------------------
       Build authoritative RPC input.

       Price, availability, provider membership, promotion value and payment
       totals must NOT be trusted from the browser.
       ---------------------------------------------------------------------- */

    const payload = {
      p_tenant_id: tenantId,
      p_service_id: serviceId,

      p_appointment_date: appointmentDate,

      p_appointment_time: appointmentTime,

      p_customer_name: customerName,

      p_customer_email: email,

      p_customer_phone: customerPhone,

      p_notes: notes,

      p_staff_id: providerId,

      p_promotion_code: promotionCode,

      p_payment_method: paymentMethod,

      p_payment_option: paymentOption,
    };

    /* ----------------------------------------------------------------------
       Create appointment using the newest payment-aware RPC.
       ---------------------------------------------------------------------- */

    const { data, error } = await supabase.rpc(
      "create_public_appointment_with_customer_payment",
      payload,
    );

    /* ----------------------------------------------------------------------
       Convert known business-rule errors into safe customer-facing messages.
       ---------------------------------------------------------------------- */

    if (error) {
      if (error.code === "PGRST202") {
        return json(
          {
            error:
              "Appointment payments are pending the latest database migration.",
          },
          503,
        );
      }
      console.error("[public-booking] Appointment RPC failed.", {
        code: error.code,
        message: error.message,
        paymentMethod,
      });
      const safePaymentError = /active bank account/i.test(error.message)
        ? "The business must add an active bank account before accepting bank-transfer deposits."
        : null;
      const bookingMigrationError = /column reference.*ambiguous/i.test(
        error.message,
      )
        ? "Appointment booking needs the latest database repair migration."
        : null;
      return json(
        {
          error:
            safePaymentError ||
            bookingMigrationError ||
            publicOperationError(
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
          error: "The appointment was not confirmed.",
        },
        502,
      );
    }

    let depositCheckout: Record<string, unknown> | null = null;
    if (paymentMethod === "bank_transfer") {
      const access = createGuestAccessToken();
      const [appointmentResult, accountsResult, settingsResult] =
        await Promise.all([
          supabase
            .from("appointments")
            .select("deposit_required,total,customer_email,payment_selection")
            .eq("id", result.appointment_id)
            .eq("tenant_id", tenantId)
            .single(),
          supabase
            .from("business_bank_accounts")
            .select(
              "id,label,bank_name,account_holder,account_number,currency,instructions,sort_order",
            )
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .order("sort_order"),
          supabase
            .from("business_fulfillment_settings")
            .select("payment_window_minutes")
            .eq("tenant_id", tenantId)
            .maybeSingle(),
        ]);
      if (appointmentResult.error || accountsResult.error) {
        console.error("[public-booking] Deposit checkout setup failed.", {
          appointmentCode: appointmentResult.error?.code,
          accountCode: accountsResult.error?.code,
        });
        return json(
          {
            error:
              "The appointment was created, but deposit setup failed. Use Track Booking to continue.",
          },
          502,
        );
      }
      const minutes = Math.max(
        5,
        Math.min(1440, settingsResult.data?.payment_window_minutes ?? 30),
      );
      const tokenExpiresAt = new Date(Date.now() + minutes * 60_000);
      const tokenUpdate = await supabase
        .from("appointments")
        .update({
          tracking_token_hash: access.hash,
          tracking_token_expires_at: tokenExpiresAt.toISOString(),
        })
        .eq("id", result.appointment_id)
        .eq("tenant_id", tenantId);
      if (tokenUpdate.error) {
        console.error("[public-booking] Deposit token setup failed.", {
          code: tokenUpdate.error.code,
        });
        return json(
          {
            error:
              "The appointment was created, but secure deposit setup failed. Use Track Booking to continue.",
          },
          502,
        );
      }
      depositCheckout = {
        accessToken: access.token,
        expiresAt: tokenExpiresAt.toISOString(),
        customerEmail: appointmentResult.data.customer_email,
        amount: Number(
          appointmentResult.data.payment_selection === "FULL"
            ? appointmentResult.data.total || 0
            : appointmentResult.data.deposit_required ||
                appointmentResult.data.total ||
                0,
        ),
        bankAccounts: (accountsResult.data ?? []).map((account) => ({
          id: account.id,
          label: account.label,
          bankName: account.bank_name,
          accountHolder: account.account_holder,
          accountNumber: account.account_number,
          currency: account.currency,
          instructions: account.instructions ?? "",
        })),
      };
    }

    /* ----------------------------------------------------------------------
       Return only the information required by the storefront.
       ---------------------------------------------------------------------- */

    // The appointment RPC queues this email atomically. Process it now as a
    // fallback when the optional database webhook is not configured.
    await processEmailQueueBestEffort("appointment creation");

    return json({
      appointmentId: result.appointment_id,

      appointmentNumber:
        paymentMethod === "bank_transfer"
          ? result.appointment_number ||
            `AP-${String(result.appointment_id).replaceAll("-", "").slice(0, 12).toUpperCase()}`
          : null,

      paymentStatus: result.payment_status || "UNPAID",

      paymentReference: result.payment_reference || null,

      createdAt: result.created_at || new Date().toISOString(),
      depositCheckout,
    });
  } catch (error) {
    /* ----------------------------------------------------------------------
       Request parsing errors
       ---------------------------------------------------------------------- */

    if (error instanceof Error && error.message === "REQUEST_TOO_LARGE") {
      return json(
        {
          error: "The booking request is too large.",
        },
        413,
      );
    }

    if (error instanceof Error && error.message === "INVALID_JSON") {
      return json(
        {
          error: "Invalid booking request.",
        },
        400,
      );
    }

    console.error("[public-booking] Unexpected request failure.", error);

    return json(
      {
        error: "Invalid booking request.",
      },
      400,
    );
  }
}
