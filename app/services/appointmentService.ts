import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

import type {
  Appointment,
  AppointmentStatus,
  PaymentStatus,
} from "@/app/types/index";

import type {
  AppointmentRow,
  AppointmentServiceRow,
} from "@/app/types/supabase";

/**
 * Represents the delivery state of an appointment-related email.
 *
 * This allows the UI to determine whether a confirmation email is:
 * - waiting to be processed
 * - currently being processed
 * - successfully sent
 * - permanently failed
 */
export interface AppointmentEmailDelivery {
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED";
  providerMessageId: string | null;
  lastError: string | null;
  sentAt: string | null;
}

/**
 * Returns the configured Supabase browser client.
 *
 * Appointment management requires Supabase. Throwing here prevents
 * functions from silently failing when the application is not configured.
 */
function client() {
  const supabase = getSupabaseBrowserClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}

/**
 * Converts database appointment statuses into the application's
 * AppointmentStatus type.
 */
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

/**
 * Converts database payment statuses into the application's
 * PaymentStatus type.
 */
function normalizePaymentStatus(value?: string | null): PaymentStatus {
  switch (value?.toUpperCase()) {
    case "PAID":
    case "COMPLETED":
      return "paid";

    case "PARTIAL":
      return "partial";

    case "REFUNDED":
      return "refunded";

    default:
      return "unpaid";
  }
}

/**
 * Returns the first service associated with an appointment.
 *
 * Appointment services are returned as an array from Supabase because
 * they are loaded through a relationship.
 */
function firstService(row: AppointmentRow): AppointmentServiceRow | null {
  return Array.isArray(row.appointment_services)
    ? (row.appointment_services[0] ?? null)
    : null;
}

/**
 * Extracts the assigned service provider's display name.
 *
 * Supabase relationship responses may return the staff relationship
 * as either an object or an array depending on the generated relation.
 */
function providerName(row: AppointmentRow) {
  if (Array.isArray(row.staff)) {
    return row.staff[0]?.display_name ?? undefined;
  }

  return row.staff?.display_name ?? undefined;
}

/**
 * Calculates appointment duration from starts_at and ends_at.
 *
 * A 30-minute fallback is used when the timestamps are unavailable
 * or produce an invalid duration.
 */
function durationFromTimes(row: AppointmentRow) {
  if (!row.starts_at || !row.ends_at) {
    return 30;
  }

  const duration = Math.round(
    (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) /
      60_000,
  );

  return duration > 0 ? duration : 30;
}

/**
 * Converts the Supabase appointment representation into the
 * application's Appointment model.
 */
function mapAppointment(row: AppointmentRow): Appointment {
  const service = firstService(row);

  const date = row.appointment_date ?? row.starts_at?.slice(0, 10) ?? "";

  const time =
    row.appointment_time?.slice(0, 5) ?? row.starts_at?.slice(11, 16) ?? "";

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

    paymentStatus: normalizePaymentStatus(row.payment_status),

    notes: row.notes ?? undefined,

    createdAt: row.created_at,

    providerId: row.staff_id ?? undefined,

    providerName: providerName(row),
  };
}

/**
 * Pagination metadata returned with one appointment page.
 *
 * Pages are zero-based because Supabase range offsets are zero-based.
 */
export interface AppointmentPage {
  appointments: Appointment[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

/**
 * Database-backed filters supported by the appointment management screen.
 */
export interface ListAppointmentsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: AppointmentStatus | "all";
}

const DEFAULT_APPOINTMENT_PAGE_SIZE = 25;
const MAX_APPOINTMENT_PAGE_SIZE = 100;
const MAX_APPOINTMENT_SEARCH_LENGTH = 120;

function normalizeAppointmentPage(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value ?? 0));
}

function normalizeAppointmentPageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_APPOINTMENT_PAGE_SIZE;
  }

  return Math.min(
    MAX_APPOINTMENT_PAGE_SIZE,
    Math.max(
      1,
      Math.floor(value ?? DEFAULT_APPOINTMENT_PAGE_SIZE),
    ),
  );
}

/**
 * Removes PostgREST `.or()` structural characters from free-text search.
 *
 * Search is still restricted to known columns below; callers cannot supply
 * arbitrary column names or operators.
 */
function normalizeAppointmentSearch(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .slice(0, MAX_APPOINTMENT_SEARCH_LENGTH)
    .replace(/[(),]/g, " ")
    .trim();
}

/**
 * Determines whether the enhanced provider relationship failed specifically
 * because the relationship is not yet available in Supabase's schema cache.
 *
 * Other database failures must not silently fall back to a different query.
 */
function canFallbackWithoutProvider(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? "";

  return (
    message.includes("display_name") ||
    message.includes("relationship") ||
    message.includes("schema cache")
  );
}

/**
 * Applies tenant, status and search constraints to an appointments query.
 *
 * Keeping this logic in one helper ensures the preferred and compatibility
 * queries always use the same filters.
 */
function applyAppointmentFilters<T extends {
  eq: (column: string, value: string) => T;
  or: (filters: string) => T;
}>(
  query: T,
  tenantId: string,
  options: ListAppointmentsOptions,
  search: string,
): T {
  let filtered = query.eq("tenant_id", tenantId);

  if (options.status && options.status !== "all") {
    filtered = filtered.eq(
      "status",
      options.status.toUpperCase(),
    );
  }

  if (search) {
    filtered = filtered.or(
      [
        `customer_name.ilike.%${search}%`,
        `customer_email.ilike.%${search}%`,
        `customer_phone.ilike.%${search}%`,
      ].join(","),
    );
  }

  return filtered;
}

/**
 * Loads one tenant-scoped appointment page.
 *
 * Scaling rules:
 * - Pagination happens in Supabase.
 * - Search/status filtering happens before pagination.
 * - Exact count supplies pagination metadata.
 * - Tenant filtering is always part of the query.
 * - starts_at + id gives deterministic ordering.
 *
 * A compatibility fallback remains for deployments where the staff/provider
 * relationship has not yet reached the Supabase schema cache.
 */
export async function listAppointments(
  tenantId: string,
  options: ListAppointmentsOptions = {},
): Promise<AppointmentPage> {
  const supabase = client();

  const safePage = normalizeAppointmentPage(options.page);
  const safePageSize = normalizeAppointmentPageSize(options.pageSize);
  const search = normalizeAppointmentSearch(options.search);

  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;

  const enhancedBase = supabase
    .from("appointments")
    .select(
      "*, appointment_services(service_id, service_name, price, duration_minutes), staff(display_name)",
      { count: "exact" },
    );

  const enhancedQuery = applyAppointmentFilters(
    enhancedBase,
    tenantId,
    options,
    search,
  );

  const enhanced = await enhancedQuery
    .order("starts_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to);

  let rows: AppointmentRow[];
  let total: number;

  if (!enhanced.error) {
    rows = (enhanced.data ?? []) as AppointmentRow[];
    total = enhanced.count ?? 0;
  } else {
    if (!canFallbackWithoutProvider(enhanced.error)) {
      throw enhanced.error;
    }

    const fallbackBase = supabase
      .from("appointments")
      .select(
        "*, appointment_services(service_id, service_name, price, duration_minutes)",
        { count: "exact" },
      );

    const fallbackQuery = applyAppointmentFilters(
      fallbackBase,
      tenantId,
      options,
      search,
    );

    const fallback = await fallbackQuery
      .order("starts_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);

    if (fallback.error) {
      throw fallback.error;
    }

    rows = (fallback.data ?? []) as AppointmentRow[];
    total = fallback.count ?? 0;
  }

  const appointments = rows.map(mapAppointment);
  const totalPages =
    total === 0 ? 0 : Math.ceil(total / safePageSize);

  return {
    appointments,
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    hasPreviousPage: safePage > 0,
    hasNextPage: from + appointments.length < total,
  };
}

/**
 * Converts public appointment availability errors into messages that
 * are safe and useful for the storefront.
 */
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

  return error instanceof Error
    ? error
    : new Error("Unable to load available times.");
}

/**
 * Loads available booking times for a public storefront.
 *
 * If a provider is supplied, availability is calculated specifically
 * for that provider. Otherwise the general tenant/service availability
 * function is used.
 */
export async function listPublicAppointmentAvailability(
  tenantId: string,
  serviceId: string,
  date: string,
  providerId?: string,
): Promise<string[]> {
  const { data, error } = await client().rpc(
    providerId
      ? "get_public_provider_availability"
      : "get_public_appointment_availability",
    {
      p_tenant_id: tenantId,
      p_service_id: serviceId,
      p_appointment_date: date,

      ...(providerId ? { p_staff_id: providerId } : {}),
    },
  );

  if (error) {
    throw availabilityError(error);
  }

  return ((data ?? []) as { appointment_time: string }[]).map((slot) =>
    slot.appointment_time.slice(0, 5),
  );
}

/**
 * Updates an appointment's lifecycle status.
 *
 * IMPORTANT DATA-INTEGRITY RULE:
 * Appointments are retained as historical transaction records.
 * Cancellation therefore changes the status to CANCELLED rather
 * than deleting the appointment.
 *
 * cancelled_at records when cancellation occurred.
 * completed_at records when completion occurred.
 *
 * This preserves appointment history for:
 * - customer support
 * - reporting
 * - payment reconciliation
 * - refunds/disputes
 * - provider history
 * - email history
 * - future audit requirements
 */
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

      /**
       * Preserve the cancellation timestamp only while the appointment
       * is in the cancelled state.
       */
      cancelled_at: status === "cancelled" ? now : null,

      /**
       * Preserve the completion timestamp only while the appointment
       * is in the completed state.
       */
      completed_at: status === "completed" ? now : null,
    })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .select("id")
    .single();

  if (error) {
    throw error;
  }
}

/**
 * Assigns or removes a service provider from an appointment.
 *
 * Provider assignment is performed through the database RPC so the
 * database remains responsible for validating tenant/provider access.
 */
export async function assignAppointmentProvider(
  tenantId: string,
  appointmentId: string,
  providerId?: string,
) {
  const { error } = await client().rpc("assign_appointment_provider", {
    p_tenant_id: tenantId,
    p_appointment_id: appointmentId,
    p_provider_id: providerId || null,
  });

  if (error) {
    throw error;
  }
}

/**
 * NOTE:
 *
 * There is intentionally NO deleteAppointment() function.
 *
 * Previous versions physically deleted appointment transactions:
 *
 *   .from("appointments").delete()
 *
 * That behavior has been removed.
 *
 * Appointments must instead transition through their lifecycle using
 * setAppointmentStatus(), including the "cancelled" state.
 *
 * Keeping the underlying appointment record ensures that related
 * payment, email, service-provider and reporting history can remain
 * associated with the original transaction.
 */

/**
 * Returns delivery information for an appointment confirmation email.
 */
export async function getAppointmentEmailDelivery(
  appointmentId: string,
): Promise<AppointmentEmailDelivery | null> {
  const { data, error } = await client()
    .from("appointment_email_deliveries")
    .select("status, provider_message_id, last_error, sent_at")
    .eq("appointment_id", appointmentId)
    .eq("event_type", "APPOINTMENT_CONFIRMED")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    status: data.status as AppointmentEmailDelivery["status"],

    providerMessageId: data.provider_message_id as string | null,

    lastError: data.last_error as string | null,

    sentAt: data.sent_at as string | null,
  };
}

/**
 * Polls the appointment email delivery record until the email reaches
 * a terminal state or the maximum number of attempts is reached.
 *
 * This does not send the email itself. It only observes the delivery
 * record maintained by the email processing system.
 */
export async function waitForAppointmentEmailDelivery(
  appointmentId: string,
  attempts = 8,
): Promise<AppointmentEmailDelivery | null> {
  let latest: AppointmentEmailDelivery | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await getAppointmentEmailDelivery(appointmentId);

    if (latest?.status === "SENT" || latest?.status === "FAILED") {
      return latest;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1000));
  }

  return latest;
}
