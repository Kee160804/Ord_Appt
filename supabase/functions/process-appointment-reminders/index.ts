import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.109.0";

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
    | { business_name: string; email: string | null; phone: string | null }
    | { business_name: string; email: string | null; phone: string | null }[]
    | null;
};

const headers = { "Content-Type": "application/json" };
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const env = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
};
function secretKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (legacy) return legacy;
  const encoded = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!encoded) throw new Error("A Supabase secret key is not available.");
  const keys = JSON.parse(encoded) as Record<string, string>;
  const key = keys.default ?? Object.values(keys)[0];
  if (!key) throw new Error("A Supabase secret key is not available.");
  return key;
}
function safeEqual(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let result = 0;
  for (let index = 0; index < actual.length; index += 1)
    result |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return result === 0;
}
const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
const first = <T>(value: T | T[] | null) =>
  Array.isArray(value) ? (value[0] ?? null) : value;

export default {
  async fetch(request: Request) {
    if (request.method !== "POST")
      return response({ error: "Method not allowed." }, 405);
    try {
      if (
        !safeEqual(
          request.headers.get("x-reminder-secret") ?? "",
          env("REMINDER_CRON_SECRET"),
        )
      )
        return response({ error: "Unauthorized." }, 401);
      const supabase = createClient(env("SUPABASE_URL"), secretKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await supabase
        .from("appointment_reminders")
        .select("id,appointment_id,reminder_minutes,attempt_count")
        .in("status", ["PENDING", "FAILED"])
        .lte("due_at", new Date().toISOString())
        .lt("attempt_count", 3)
        .order("due_at")
        .limit(50);
      if (error) throw error;
      let sent = 0;
      let failed = 0;
      for (const reminder of (data ?? []) as Reminder[]) {
        const { data: claimed } = await supabase
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
        if (!claimed) continue;
        try {
          const { data: appointmentData, error: appointmentError } =
            await supabase
              .from("appointments")
              .select(
                "customer_email,customer_name,starts_at,status,appointment_services(service_name),tenants(business_name,email,phone)",
              )
              .eq("id", reminder.appointment_id)
              .single();
          if (appointmentError) throw appointmentError;
          const appointment = appointmentData as unknown as Appointment;
          if (
            ["CANCELLED", "NO_SHOW"].includes(appointment.status.toUpperCase())
          ) {
            await supabase
              .from("appointment_reminders")
              .update({
                status: "CANCELLED",
                updated_at: new Date().toISOString(),
              })
              .eq("id", reminder.id);
            continue;
          }
          if (!appointment.customer_email || !appointment.starts_at)
            throw new Error("Appointment has no reminder email or start time.");
          const tenant = first(appointment.tenants);
          const service =
            appointment.appointment_services?.[0]?.service_name ??
            "appointment";
          const business = tenant?.business_name ?? "the business";
          const when = new Intl.DateTimeFormat("en-BZ", {
            dateStyle: "full",
            timeStyle: "short",
            timeZone: "America/Belize",
          }).format(new Date(appointment.starts_at));
          const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><div style="background:#6d28d9;color:white;padding:24px;border-radius:16px 16px 0 0"><h1 style="margin:0;font-size:24px">Appointment reminder</h1></div><div style="border:1px solid #e2e8f0;padding:24px;border-radius:0 0 16px 16px"><p>Hi ${escapeHtml(appointment.customer_name ?? "there")},</p><p>This is a reminder for your <strong>${escapeHtml(service)}</strong> appointment with <strong>${escapeHtml(business)}</strong>.</p><p><strong>${escapeHtml(when)}</strong></p>${tenant?.phone || tenant?.email ? `<p>Questions? Contact ${escapeHtml([tenant.phone, tenant.email].filter(Boolean).join(" or "))}.</p>` : ""}</div></div>`;
          const resend = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env("RESEND_API_KEY")}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `appointment-reminder/${reminder.id}`,
            },
            body: JSON.stringify({
              from: env("RESEND_FROM_EMAIL"),
              to: [appointment.customer_email],
              subject: `Reminder: ${service} with ${business}`,
              html,
              reply_to: tenant?.email || undefined,
            }),
          });
          const result = (await resend.json()) as {
            id?: string;
            message?: string;
          };
          if (!resend.ok || !result.id)
            throw new Error(
              result.message || `Resend returned ${resend.status}.`,
            );
          await supabase
            .from("appointment_reminders")
            .update({
              status: "SENT",
              provider_message_id: result.id,
              sent_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", reminder.id);
          sent += 1;
        } catch (deliveryError) {
          await supabase
            .from("appointment_reminders")
            .update({
              status: "FAILED",
              last_error: (deliveryError instanceof Error
                ? deliveryError.message
                : "Unable to send reminder."
              ).slice(0, 1000),
              updated_at: new Date().toISOString(),
            })
            .eq("id", reminder.id);
          failed += 1;
        }
      }
      return response({ processed: (data ?? []).length, sent, failed });
    } catch (error) {
      console.error(error);
      return response(
        {
          error:
            error instanceof Error
              ? error.message
              : "Unable to process reminders.",
        },
        500,
      );
    }
  },
};
