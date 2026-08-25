// Supabase Edge Runtime APIs and database client.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

type DeliveryStatus = "PENDING" | "PROCESSING" | "SENT" | "FAILED";

interface AppointmentEmailPayload {
  appointment_id: string;
  confirmation_code: string;
  business_name: string;
  business_email?: string | null;
  business_phone?: string | null;
  business_address?: string | null;
  business_city?: string | null;
  service_name: string;
  starts_at?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  timezone?: string | null;
}

interface DeliveryRow {
  id: string;
  appointment_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  payload: AppointmentEmailPayload;
  status: DeliveryStatus;
  attempt_count: number;
}

interface WebhookBody {
  type?: string;
  table?: string;
  schema?: string;
  record?: { id?: string };
}

const jsonHeaders = { "Content-Type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function getSupabaseSecretKey() {
  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacyKey) return legacyKey;

  const encodedKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!encodedKeys) throw new Error("A Supabase secret key is not available.");

  const keys = JSON.parse(encodedKeys) as Record<string, string>;
  const key = keys.default ?? Object.values(keys)[0];
  if (!key) throw new Error("A Supabase secret key is not available.");
  return key;
}

function safeEqual(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < actual.length; index += 1) {
    result |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return result === 0;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatAppointmentTime(payload: AppointmentEmailPayload) {
  if (payload.starts_at) {
    const date = new Date(payload.starts_at);
    if (!Number.isNaN(date.getTime())) {
      try {
        return new Intl.DateTimeFormat("en-US", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: payload.timezone || "America/Belize",
        }).format(date);
      } catch {
        // Fall back to the separately stored local date and time below.
      }
    }
  }

  const time = payload.appointment_time?.slice(0, 5) ?? "";
  return [payload.appointment_date, time].filter(Boolean).join(" at ");
}

function buildEmail(delivery: DeliveryRow) {
  const payload = delivery.payload;
  const businessName = escapeHtml(payload.business_name);
  const customerName = escapeHtml(delivery.recipient_name);
  const serviceName = escapeHtml(payload.service_name);
  const appointmentTime = escapeHtml(formatAppointmentTime(payload));
  const confirmationCode = escapeHtml(payload.confirmation_code);
  const location = [payload.business_address, payload.business_city].filter(Boolean).join(", ");
  const contactItems = [payload.business_phone, payload.business_email].filter(Boolean);

  const details = [
    `<tr><td style="padding:8px 0;color:#64748b">Service</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a">${serviceName}</td></tr>`,
    `<tr><td style="padding:8px 0;color:#64748b">Date &amp; time</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a">${appointmentTime}</td></tr>`,
    location
      ? `<tr><td style="padding:8px 0;color:#64748b">Location</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a">${escapeHtml(location)}</td></tr>`
      : "",
    `<tr><td style="padding:8px 0;color:#64748b">Confirmation</td><td style="padding:8px 0;text-align:right;font-weight:700;color:#7c3aed">${confirmationCode}</td></tr>`,
  ].join("");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a">
    <div style="max-width:600px;margin:0 auto;padding:32px 16px">
      <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:#6d28d9;padding:28px 32px;color:#ffffff">
          <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85">Appointment confirmed</div>
          <h1 style="font-size:26px;line-height:1.25;margin:8px 0 0">You're booked with ${businessName}</h1>
        </div>
        <div style="padding:30px 32px">
          <p style="font-size:16px;line-height:1.6;margin:0 0 20px">Hi ${customerName}, your appointment has been approved and confirmed.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 22px">${details}</table>
          ${contactItems.length ? `<p style="font-size:14px;line-height:1.6;color:#475569;margin:0">Questions? Contact ${businessName} at ${escapeHtml(contactItems.join(" or "))}.</p>` : ""}
        </div>
      </div>
      <p style="font-size:12px;line-height:1.5;text-align:center;color:#94a3b8;margin:18px 0 0">Sent by LocalSpace on behalf of ${businessName}.</p>
    </div>
  </body>
</html>`;

  const text = [
    `Hi ${delivery.recipient_name},`,
    "",
    `Your appointment with ${payload.business_name} is confirmed.`,
    `Service: ${payload.service_name}`,
    `Date & time: ${formatAppointmentTime(payload)}`,
    location ? `Location: ${location}` : "",
    `Confirmation: ${payload.confirmation_code}`,
    contactItems.length ? `Questions? Contact ${contactItems.join(" or ")}.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

    try {
      const webhookSecret = requiredEnv("NOTIFICATION_WEBHOOK_SECRET");
      const providedSecret = request.headers.get("x-webhook-secret") ?? "";
      if (!safeEqual(providedSecret, webhookSecret)) {
        return json({ error: "Unauthorized." }, 401);
      }

      const body = (await request.json()) as WebhookBody;
      if (
        body.type !== "INSERT" ||
        body.schema !== "public" ||
        body.table !== "appointment_email_deliveries" ||
        !body.record?.id
      ) {
        return json({ error: "Unsupported webhook payload." }, 400);
      }

      const supabase = createClient(requiredEnv("SUPABASE_URL"), getSupabaseSecretKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const { data: currentData, error: readError } = await supabase
        .from("appointment_email_deliveries")
        .select(
          "id, appointment_id, recipient_email, recipient_name, subject, payload, status, attempt_count",
        )
        .eq("id", body.record.id)
        .single();

      const current = currentData as DeliveryRow | null;
      if (readError || !current) throw readError ?? new Error("Email delivery was not found.");
      if (current.status === "SENT") return json({ delivered: true, duplicate: true });

      const { data: deliveryData, error: claimError } = await supabase
        .from("appointment_email_deliveries")
        .update({
          status: "PROCESSING",
          attempt_count: current.attempt_count + 1,
          processing_started_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", current.id)
        .in("status", ["PENDING", "FAILED"])
        .select(
          "id, appointment_id, recipient_email, recipient_name, subject, payload, status, attempt_count",
        )
        .maybeSingle();

      const delivery = deliveryData as DeliveryRow | null;
      if (claimError) throw claimError;
      if (!delivery) return json({ delivered: false, duplicate: true }, 202);

      const resendApiKey = requiredEnv("RESEND_API_KEY");
      const from = requiredEnv("RESEND_FROM_EMAIL");
      const email = buildEmail(delivery);
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `appointment-confirmed/${delivery.appointment_id}`,
        },
        body: JSON.stringify({
          from,
          to: [delivery.recipient_email],
          subject: delivery.subject,
          html: email.html,
          text: email.text,
          reply_to: delivery.payload.business_email || undefined,
        }),
      });

      const resendResult = (await resendResponse.json()) as { id?: string; message?: string };
      if (!resendResponse.ok || !resendResult.id) {
        const providerError = resendResult.message || `Resend returned ${resendResponse.status}.`;
        await supabase
          .from("appointment_email_deliveries")
          .update({ status: "FAILED", last_error: providerError.slice(0, 1000) })
          .eq("id", delivery.id);
        return json({ error: providerError }, 502);
      }

      const { error: sentError } = await supabase
        .from("appointment_email_deliveries")
        .update({
          status: "SENT",
          provider_message_id: resendResult.id,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", delivery.id);

      if (sentError) throw sentError;
      return json({ delivered: true, id: resendResult.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send confirmation email.";
      console.error(message);
      return json({ error: message }, 500);
    }
  },
};
