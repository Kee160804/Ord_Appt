import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

export interface ServiceProvider {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  bio: string;
  color: string;
  isActive: boolean;
  serviceIds: string[];
  availability: ProviderAvailability[];
}

export interface ProviderAvailability {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface ServiceDepartment {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Promotion {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  usageCount: number;
  applicableProductIds: string[];
  applicableServiceIds: string[];
  isActive: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  minutes: number[];
}

export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  reminderMinutes: number;
  dueAt: string;
  channel: string;
  status: string;
  lastError: string;
}

type Row = Record<string, unknown>;

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function listServiceProviders(
  tenantId: string,
): Promise<ServiceProvider[]> {
  const supabase = client();
  const [providersResult, assignmentsResult, availabilityResult] =
    await Promise.all([
      supabase
        .from("staff")
        .select(
          "id, tenant_id, display_name, email, phone, bio, color, is_active, accepts_appointments",
        )
        .eq("tenant_id", tenantId)
        .eq("accepts_appointments", true)
        .order("display_name"),
      supabase
        .from("staff_services")
        .select("staff_id, service_id")
        .eq("tenant_id", tenantId),
      supabase
        .from("staff_availability")
        .select("staff_id, day_of_week, start_time, end_time, is_available")
        .eq("tenant_id", tenantId),
    ]);
  if (providersResult.error) throw providersResult.error;
  if (assignmentsResult.error) throw assignmentsResult.error;
  if (availabilityResult.error) throw availabilityResult.error;
  const servicesByProvider = new Map<string, string[]>();
  for (const raw of assignmentsResult.data ?? []) {
    const row = raw as Row;
    const staffId = textValue(row.staff_id);
    const serviceId = textValue(row.service_id);
    if (staffId && serviceId)
      servicesByProvider.set(staffId, [
        ...(servicesByProvider.get(staffId) ?? []),
        serviceId,
      ]);
  }
  const availabilityByProvider = new Map<string, ProviderAvailability[]>();
  for (const raw of availabilityResult.data ?? []) {
    const row = raw as Row;
    const staffId = textValue(row.staff_id);
    const entry = {
      dayOfWeek: Number(row.day_of_week),
      startTime: textValue(row.start_time).slice(0, 5),
      endTime: textValue(row.end_time).slice(0, 5),
      isAvailable: row.is_available !== false,
    };
    availabilityByProvider.set(staffId, [
      ...(availabilityByProvider.get(staffId) ?? []),
      entry,
    ]);
  }
  return (providersResult.data ?? []).map((raw) => {
    const row = raw as Row;
    const id = textValue(row.id);
    return {
      id,
      tenantId: textValue(row.tenant_id),
      name: textValue(row.display_name) || "Service provider",
      email: textValue(row.email),
      phone: textValue(row.phone),
      bio: textValue(row.bio),
      color: textValue(row.color) || "#8b5cf6",
      isActive: row.is_active !== false,
      serviceIds: servicesByProvider.get(id) ?? [],
      availability: availabilityByProvider.get(id) ?? [],
    };
  });
}

export async function saveServiceProvider(
  tenantId: string,
  provider: Omit<ServiceProvider, "tenantId">,
): Promise<void> {
  const supabase = client();
  const { error } = await supabase.rpc("save_service_provider", {
    p_tenant_id: tenantId,
    p_provider_id: provider.id || null,
    p_name: provider.name.trim(),
    p_email: provider.email.trim() || null,
    p_phone: provider.phone.trim() || null,
    p_bio: provider.bio.trim() || null,
    p_color: provider.color,
    p_is_active: provider.isActive,
    p_service_ids: provider.serviceIds,
    p_availability: provider.availability.map((day) => ({
      day_of_week: day.dayOfWeek,
      start_time: day.startTime,
      end_time: day.endTime,
      is_available: day.isAvailable,
    })),
  });
  if (error) throw error;
}

export async function listDepartments(
  tenantId: string,
): Promise<ServiceDepartment[]> {
  const { data, error } = await client()
    .from("service_departments")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((raw) => {
    const row = raw as Row;
    return {
      id: textValue(row.id),
      tenantId: textValue(row.tenant_id),
      name: textValue(row.name),
      description: textValue(row.description),
      sortOrder: Number(row.sort_order ?? 0),
      isActive: row.is_active !== false,
    };
  });
}

export async function createDepartment(
  tenantId: string,
  name: string,
  description: string,
) {
  const { error } = await client()
    .from("service_departments")
    .insert({
      tenant_id: tenantId,
      name: name.trim(),
      description: description.trim() || null,
    });
  if (error) throw error;
}

export async function setDepartmentActive(
  tenantId: string,
  id: string,
  active: boolean,
) {
  const { error } = await client()
    .from("service_departments")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw error;
}

export async function assignServiceDepartment(
  tenantId: string,
  serviceId: string,
  department: ServiceDepartment | null,
) {
  const { error } = await client()
    .from("services")
    .update({
      department_id: department?.id ?? null,
      category: department?.name ?? "Services",
    })
    .eq("tenant_id", tenantId)
    .eq("id", serviceId);
  if (error) throw error;
}

export async function listPromotions(tenantId: string): Promise<Promotion[]> {
  const { data, error } = await client()
    .from("promotions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((raw) => {
    const row = raw as Row;
    return {
      id: textValue(row.id),
      tenantId: textValue(row.tenant_id),
      code: textValue(row.code),
      name: textValue(row.name),
      discountType: row.discount_type === "FIXED" ? "FIXED" : "PERCENTAGE",
      discountValue: Number(row.discount_value ?? 0),
      startsAt: textValue(row.starts_at),
      endsAt: textValue(row.ends_at),
      usageLimit: row.usage_limit == null ? null : Number(row.usage_limit),
      usageCount: Number(row.usage_count ?? 0),
      applicableProductIds: stringArray(row.applicable_product_ids),
      applicableServiceIds: stringArray(row.applicable_service_ids),
      isActive: row.is_active !== false,
    };
  });
}

export async function savePromotion(
  tenantId: string,
  promotion: Omit<Promotion, "tenantId" | "usageCount">,
) {
  const values = {
    tenant_id: tenantId,
    code: promotion.code.trim().toUpperCase(),
    name: promotion.name.trim(),
    discount_type: promotion.discountType,
    discount_value: promotion.discountValue,
    starts_at: promotion.startsAt || null,
    ends_at: promotion.endsAt || null,
    usage_limit: promotion.usageLimit,
    applicable_product_ids: promotion.applicableProductIds,
    applicable_service_ids: promotion.applicableServiceIds,
    is_active: promotion.isActive,
    updated_at: new Date().toISOString(),
  };
  const query = promotion.id
    ? client()
        .from("promotions")
        .update(values)
        .eq("tenant_id", tenantId)
        .eq("id", promotion.id)
    : client().from("promotions").insert(values);
  const { error } = await query;
  if (error) throw error;
}

export async function setPromotionActive(
  tenantId: string,
  id: string,
  active: boolean,
) {
  const { error } = await client()
    .from("promotions")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("id", id);
  if (error) throw error;
}

export async function validatePromotion(
  tenantId: string,
  code: string,
  amount: number,
  productIds: string[] = [],
  serviceId?: string,
) {
  const response = await fetch("/api/public/promotions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, code, amount, productIds, serviceId }),
  });
  const row = (await response.json()) as Row & { error?: string };
  if (!response.ok)
    throw new Error(row.error || "That discount code is not valid.");
  return {
    code: textValue(row.code),
    name: textValue(row.name),
    discountType:
      row.discountType === "FIXED"
        ? ("FIXED" as const)
        : ("PERCENTAGE" as const),
    discountValue: Number(row.discountValue ?? 0),
    discountAmount: Number(row.discountAmount ?? 0),
    applicableProductIds: stringArray(row.applicableProductIds),
  };
}

export async function getReminderSettings(
  tenantId: string,
): Promise<ReminderSettings> {
  const { data, error } = await client()
    .from("business_settings")
    .select("appointment_reminders_enabled, appointment_reminder_minutes")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  const row = (data ?? {}) as Row;
  return {
    enabled: row.appointment_reminders_enabled !== false,
    minutes: Array.isArray(row.appointment_reminder_minutes)
      ? row.appointment_reminder_minutes.map(Number)
      : [1440, 120],
  };
}

export async function saveReminderSettings(
  tenantId: string,
  settings: ReminderSettings,
) {
  const { error } = await client().from("business_settings").upsert(
    {
      tenant_id: tenantId,
      appointment_reminders_enabled: settings.enabled,
      appointment_reminder_minutes: settings.minutes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw error;
}

export async function listAppointmentReminders(
  tenantId: string,
): Promise<AppointmentReminder[]> {
  const { data, error } = await client()
    .from("appointment_reminders")
    .select(
      "id, appointment_id, reminder_minutes, due_at, channel, status, last_error",
    )
    .eq("tenant_id", tenantId)
    .order("due_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((raw) => {
    const row = raw as Row;
    return {
      id: textValue(row.id),
      appointmentId: textValue(row.appointment_id),
      reminderMinutes: Number(row.reminder_minutes),
      dueAt: textValue(row.due_at),
      channel: textValue(row.channel),
      status: textValue(row.status),
      lastError: textValue(row.last_error),
    };
  });
}
