import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { Appointment, AppointmentStatus } from "@/app/types/index";
import type { AppointmentRow, AppointmentServiceRow } from "@/app/types/supabase";

export interface AppointmentEmailDelivery {
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  providerMessageId: string | null;
  lastError: string | null;
  sentAt: string | null;
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function normalizeStatus(value: string): AppointmentStatus {
  switch (value.toUpperCase()) {
    case "CONFIRMED":
      return "confirmed";
    case "CANCELLED":
      return "cancelled";
    case "COMPLETED":
      return "completed";
    case "NO_SHOW":
      return "no_show";
    default:
      return "pending";
  }
}

function firstService(row: AppointmentRow): AppointmentServiceRow | null {
  return Array.isArray(row.appointment_services) ? row.appointment_services[0] ?? null : null;
}

function providerName(row: AppointmentRow) {
  if (Array.isArray(row.staff)) return row.staff[0]?.display_name ?? undefined;
  return row.staff?.display_name ?? undefined;
}

function durationFromTimes(row: AppointmentRow) {
  if (!row.starts_at || !row.ends_at) return 30;
  const duration = Math.round(
    (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60_000,
  );
  return duration > 0 ? duration : 30;
}

function mapAppointment(row: AppointmentRow): Appointment {
  const service = firstService(row);
  const date = row.appointment_date ?? row.starts_at?.slice(0, 10) ?? "";
  const time = row.appointment_time?.slice(0, 5) ?? row.starts_at?.slice(11, 16) ?? "";

  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerId: row.customer_id ?? undefined,
    serviceId: service?.service_id ?? row.service_id ?? "",
    serviceName: service?.service_name ?? "Service",
    servicePrice: Number(service?.price ?? row.total ?? row.subtotal ?? 0),
    customerName: row.customer_name ?? "Customer",
    customerEmail: row.customer_email ?? "",
    customerPhone: row.customer_phone ?? "",
    date,
    time,
    duration: service?.duration_minutes ?? durationFromTimes(row),
    status: normalizeStatus(row.status),
    paymentStatus: "unpaid",
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    providerId: row.staff_id ?? undefined,
    providerName: providerName(row),
  };
}

export async function listAppointments(tenantId: string): Promise<Appointment[]> {
  const supabase = client();
  const enhanced = await supabase
    .from("appointments")
    .select("*, appointment_services(service_id, service_name, price, duration_minutes), staff(display_name)")
    .eq("tenant_id", tenantId)
    .order("starts_at", { ascending: true });
  if (!enhanced.error) return ((enhanced.data ?? []) as AppointmentRow[]).map(mapAppointment);

  // Keep appointments usable during a rolling deployment before the provider
  // migration reaches Supabase. Unrelated database errors still surface.
  const message = enhanced.error.message.toLowerCase();
  if (!message.includes("display_name") && !message.includes("relationship") && !message.includes("schema cache")) throw enhanced.error;
  const fallback = await supabase.from("appointments").select("*, appointment_services(service_id, service_name, price, duration_minutes)").eq("tenant_id", tenantId).order("starts_at", { ascending: true });
  if (fallback.error) throw fallback.error;
  return ((fallback.data ?? []) as AppointmentRow[]).map(mapAppointment);
}

function availabilityError(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "PGRST202"
  ) {
    return new Error(
      "Online booking availability is not enabled for this store yet. Apply the public appointment availability migration in Supabase, then try again.",
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
  return error instanceof Error ? error : new Error("Unable to load available times.");
}

export async function listPublicAppointmentAvailability(
  tenantId: string,
  serviceId: string,
  date: string,
  providerId?: string,
): Promise<string[]> {
  const { data, error } = await client().rpc(providerId ? "get_public_provider_availability" : "get_public_appointment_availability", {
    p_tenant_id: tenantId,
    p_service_id: serviceId,
    p_appointment_date: date,
    ...(providerId ? { p_staff_id: providerId } : {}),
  });
  if (error) throw availabilityError(error);
  return ((data ?? []) as { appointment_time: string }[]).map((slot) =>
    slot.appointment_time.slice(0, 5),
  );
}

export async function setAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  status: AppointmentStatus,
) {
  const now = new Date().toISOString();
  const { error } = await client()
    .from("appointments")
    .update({
      status: status.toUpperCase(),
      cancelled_at: status === "cancelled" ? now : null,
      completed_at: status === "completed" ? now : null,
    })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) throw error;
}

export async function assignAppointmentProvider(tenantId: string, appointmentId: string, providerId?: string) {
  const { error } = await client().rpc("assign_appointment_provider", { p_tenant_id: tenantId, p_appointment_id: appointmentId, p_provider_id: providerId || null });
  if (error) throw error;
}

export async function deleteAppointment(tenantId: string, appointmentId: string) {
  const { error } = await client()
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) throw error;
}

export async function getAppointmentEmailDelivery(
  appointmentId: string,
): Promise<AppointmentEmailDelivery | null> {
  const { data, error } = await client()
    .from("appointment_email_deliveries")
    .select("status, provider_message_id, last_error, sent_at")
    .eq("appointment_id", appointmentId)
    .eq("event_type", "APPOINTMENT_CONFIRMED")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    status: data.status as AppointmentEmailDelivery["status"],
    providerMessageId: data.provider_message_id as string | null,
    lastError: data.last_error as string | null,
    sentAt: data.sent_at as string | null,
  };
}

export async function waitForAppointmentEmailDelivery(
  appointmentId: string,
  attempts = 8,
): Promise<AppointmentEmailDelivery | null> {
  let latest: AppointmentEmailDelivery | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await getAppointmentEmailDelivery(appointmentId);
    if (latest?.status === "SENT" || latest?.status === "FAILED") return latest;
    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }

  return latest;
}
