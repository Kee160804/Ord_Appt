import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

/**
 * Supabase Edge Function that processes due appointment reminders.
 *
 * IMPORTANT:
 * This function sends reminder emails directly through Resend. The project
 * also has a centralized Next.js transactional-email worker, so the database
 * and webhook/cron configuration must ultimately ensure that only one pipeline
 * owns appointment reminders in production.
 */

type Reminder = {
  id: string;
  appointment_id: string;
  reminder_minutes: number;
  attempt_count: number;
};

type Appointment = {
  customer_email: string | null;
  customer_name: string | null;
  starts_at: string | null;
  status: string;
  appointment_services: { service_name: string }[] | null;
  tenants:
    | {
        business_name: string;
        email: string | null;
        phone: string | null;
      }
    | {
        business_name: string;
        email: string | null;
        phone: string | null;
      }[]
    | null;
};

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

/**
 * Reads a required Edge Function environment variable.
 */
function env(name: string): string {
  const value = Deno.env.get(name)?.trim();

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

/**
 * Returns the Supabase service-role/secret key.
 *
 * SUPABASE_SERVICE_ROLE_KEY is supported for existing deployments.
 * SUPABASE_SECRET_KEYS is also supported for environments exposing the newer
 * encoded secret-key collection.
 */
function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (legacy) {
    return legacy;
  }

  const encoded = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!encoded) {
    throw new Error("A Supabase secret key is not available.");
  }

  let keys: Record<string, string>;

  try {
    keys = JSON.parse(encoded) as Record<string, string>;
  } catch {
    throw new Error("SUPABASE_SECRET_KEYS is not valid JSON.");
  }

  const key = keys.default ?? Object.values(keys)[0];

  if (!key) {
    throw new Error("A Supabase secret key is not available.");
  }

  return key;
}

/**
 * Constant-work secret comparison suitable for the Supabase Edge/Deno runtime.
 */
function safeEqual(actual: string, expected: string): boolean {
  if (actual.length !== expected.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < actual.length; index += 1) {
    result |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }

  return result === 0;
}

/**
 * Escapes untrusted values before inserting them into HTML email markup.
 */
function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Supabase relation selects can be returned either as one object or an array.
 */
function first<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Performs a basic recipient-email validation before calling Resend.
 */
function validEmail(value: string): boolean {
  return (
    value.length <= 254 &&
    /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)
  );
}

/**
 * Safely formats the appointment timestamp in Belize local time.
 */
function formatAppointmentTime(startsAt: string): string | null {
  const date = new Date(startsAt);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  try {
    return new Intl.DateTimeFormat("en-BZ", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Belize",
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * Marks a reminder with a terminal/intermediate status and verifies that the
 * database update succeeded.
 */
async function updateReminder(
  supabase: ReturnType<typeof createClient>,
  reminderId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from("appointment_reminders")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reminderId);

  if (error) {
    throw error;
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return response({ error: "Method not allowed." }, 405);
    }

    try {
      /* --------------------------------------------------------------------
         1. Authenticate the scheduler
         -------------------------------------------------------------------- */

      const expectedSecret = env("REMINDER_CRON_SECRET");
      const providedSecret =
        request.headers.get("x-reminder-secret")?.trim() ?? "";

      if (
        expectedSecret.length < 16 ||
        !safeEqual(providedSecret, expectedSecret)
      ) {
        return response({ error: "Unauthorized." }, 401);
      }

      /* --------------------------------------------------------------------
         2. Create a service-role Supabase client
         -------------------------------------------------------------------- */

      const supabase = createClient(env("SUPABASE_URL"), secretKey(), {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });

      const now = new Date();

      /* --------------------------------------------------------------------
         3. Load due reminders with attempts remaining
         -------------------------------------------------------------------- */

      const { data, error } = await supabase
        .from("appointment_reminders")
        .select("id,appointment_id,reminder_minutes,attempt_count")
        .in("status", ["PENDING", "FAILED"])
        .lte("due_at", now.toISOString())
        .lt("attempt_count", 3)
        .order("due_at")
        .limit(50);

      if (error) {
        throw error;
      }

      let sent = 0;
      let failed = 0;
      let cancelled = 0;
      let skipped = 0;

      for (const reminder of (data ?? []) as Reminder[]) {
        /* ------------------------------------------------------------------
           4. Claim each reminder before processing it

           Only PENDING/FAILED rows may transition to PROCESSING. If another
           invocation already claimed the same reminder, maybeSingle() returns
           no row and this invocation safely skips it.
           ------------------------------------------------------------------ */

        const { data: claimed, error: claimError } = await supabase
          .from("appointment_reminders")
          .update({
            status: "PROCESSING",
            attempt_count: reminder.attempt_count + 1,
            last_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", reminder.id)
          .in("status", ["PENDING", "FAILED"])
          .select("id")
          .maybeSingle();

        if (claimError) {
          console.error(
            `[appointment-reminders] Unable to claim ${reminder.id}:`,
            claimError.message,
          );
          failed += 1;
          continue;
        }

        if (!claimed) {
          skipped += 1;
          continue;
        }

        try {
          /* ----------------------------------------------------------------
             5. Reload authoritative appointment/business information
             ---------------------------------------------------------------- */

          const { data: appointmentData, error: appointmentError } =
            await supabase
              .from("appointments")
              .select(
                "customer_email,customer_name,starts_at,status,appointment_services(service_name),tenants(business_name,email,phone)",
              )
              .eq("id", reminder.appointment_id)
              .single();

          if (appointmentError) {
            throw appointmentError;
          }

          const appointment = appointmentData as unknown as Appointment;
          const appointmentStatus = appointment.status?.toUpperCase() ?? "";

          /**
           * A reminder must never be delivered for an appointment that has
           * already been cancelled or marked as a no-show.
           */
          if (["CANCELLED", "NO_SHOW"].includes(appointmentStatus)) {
            await updateReminder(supabase, reminder.id, {
              status: "CANCELLED",
              last_error: null,
            });

            cancelled += 1;
            continue;
          }

          if (!appointment.customer_email || !appointment.starts_at) {
            throw new Error("Appointment has no reminder email or start time.");
          }

          const recipient = appointment.customer_email.trim().toLowerCase();

          if (!validEmail(recipient)) {
            throw new Error("Appointment has an invalid reminder email.");
          }

          const appointmentDate = new Date(appointment.starts_at);

          if (Number.isNaN(appointmentDate.getTime())) {
            throw new Error("Appointment has an invalid start time.");
          }

          /**
           * Do not send stale reminders after the appointment start time.
           */
          if (appointmentDate <= new Date()) {
            await updateReminder(supabase, reminder.id, {
              status: "CANCELLED",
              last_error: "Appointment start time has already passed.",
            });

            cancelled += 1;
            continue;
          }

          const tenant = first(appointment.tenants);
          const service =
            appointment.appointment_services?.[0]?.service_name?.trim() ||
            "appointment";
          const business = tenant?.business_name?.trim() || "the business";

          const when = formatAppointmentTime(appointment.starts_at);

          if (!when) {
            throw new Error("Unable to format appointment start time.");
          }

          /* ----------------------------------------------------------------
             6. Build safe HTML and plain-text versions
             ---------------------------------------------------------------- */

          const contact = [tenant?.phone, tenant?.email]
            .filter((value): value is string => Boolean(value?.trim()))
            .join(" or ");

          const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:560px;margin:0 auto;padding:32px 16px">
      <div style="overflow:hidden;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff">
        <div style="background:#6d28d9;color:#ffffff;padding:24px">
          <h1 style="margin:0;font-size:24px">Appointment reminder</h1>
        </div>

        <div style="padding:24px">
          <p>Hi ${escapeHtml(appointment.customer_name ?? "there")},</p>

          <p>
            This is a reminder for your
            <strong>${escapeHtml(service)}</strong>
            appointment with
            <strong>${escapeHtml(business)}</strong>.
          </p>

          <p><strong>${escapeHtml(when)}</strong></p>

          ${contact ? `<p>Questions? Contact ${escapeHtml(contact)}.</p>` : ""}
        </div>
      </div>

      <p style="font-size:12px;line-height:1.5;text-align:center;color:#94a3b8;margin:18px 0 0">
        Sent by YuhBusiness on behalf of ${escapeHtml(business)}.
      </p>
    </div>
  </body>
</html>`;

          const text = [
            `Hi ${appointment.customer_name?.trim() || "there"},`,
            "",
            `This is a reminder for your ${service} appointment with ${business}.`,
            `Date & time: ${when}`,
            contact ? `Questions? Contact ${contact}.` : "",
            "",
            `Sent by YuhBusiness on behalf of ${business}.`,
          ]
            .filter(Boolean)
            .join("\n");

          /* ----------------------------------------------------------------
             7. Send through Resend

             The reminder ID is stable, so retrying the same reminder uses the
             same provider idempotency key.
             ---------------------------------------------------------------- */

          const resend = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env("RESEND_API_KEY")}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `appointment-reminder/${reminder.id}`,
            },
            body: JSON.stringify({
              from: env("RESEND_FROM_EMAIL"),
              to: [recipient],
              subject: `Reminder: ${service} with ${business}`,
              html,
              text,
              reply_to: tenant?.email || undefined,
            }),
          });

          let result: {
            id?: string;
            message?: string;
          } = {};

          try {
            result = (await resend.json()) as {
              id?: string;
              message?: string;
            };
          } catch {
            // A non-JSON provider response is handled by the status check below.
          }

          if (!resend.ok || !result.id) {
            throw new Error(
              result.message || `Resend returned ${resend.status}.`,
            );
          }

          /* ----------------------------------------------------------------
             8. Record provider acceptance

             SENT means Resend accepted the message. It does not prove final
             inbox delivery; delivery/bounce state requires Resend webhooks.
             ---------------------------------------------------------------- */

          await updateReminder(supabase, reminder.id, {
            status: "SENT",
            provider_message_id: result.id,
            sent_at: new Date().toISOString(),
            last_error: null,
          });

          sent += 1;
        } catch (deliveryError) {
          const message =
            deliveryError instanceof Error
              ? deliveryError.message
              : "Unable to send reminder.";

          try {
            await updateReminder(supabase, reminder.id, {
              status: "FAILED",
              last_error: message.slice(0, 1000),
            });
          } catch (updateError) {
            console.error(
              `[appointment-reminders] Unable to record failure for ${reminder.id}:`,
              updateError,
            );
          }

          console.error(
            `[appointment-reminders] Delivery ${reminder.id} failed:`,
            message,
          );

          failed += 1;
        }
      }

      return response({
        processed: (data ?? []).length,
        sent,
        failed,
        cancelled,
        skipped,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to process appointment reminders.";

      console.error("[appointment-reminders]", message);

      /**
       * Do not expose environment variables, database errors, or provider
       * details to the external scheduler.
       */
      return response(
        {
          error: "Unable to process appointment reminders.",
        },
        500,
      );
    }
  },
};
