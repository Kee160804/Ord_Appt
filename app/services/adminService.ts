import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { AnalyticsSummary, Tenant, TopItem } from "@/app/types/index";
import type { TenantRow } from "@/app/types/supabase";

const PAGE_SIZE = 1000;

interface QueryError {
  message: string;
}

interface PageResult<T> {
  data: T[] | null;
  error: QueryError | null;
}

interface AdminOrderItemRow {
  product_name: string;
  quantity: number | string;
  subtotal: number | string;
}

interface AdminOrderRow {
  id: string;
  tenant_id: string;
  status: string;
  total: number | string;
  created_at: string;
  order_items: AdminOrderItemRow[] | null;
}

interface AdminAppointmentServiceRow {
  service_name: string;
  price: number | string;
}

interface AdminAppointmentRow {
  id: string;
  tenant_id: string;
  status: string;
  total: number | string | null;
  subtotal: number | string | null;
  created_at: string;
  appointment_services: AdminAppointmentServiceRow[] | null;
}

interface AdminCustomerRow {
  id: string;
  tenant_id: string;
}

export interface AdminTenantData {
  tenant: Tenant;
  analytics: AnalyticsSummary;
}

export interface AdminPlatformData {
  tenants: Tenant[];
  analyticsByTenant: Record<string, AnalyticsSummary>;
  totalRevenue: number;
  totalActivity: number;
  totalCustomers: number;
}

function client() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

async function collectPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function mapTenant(row: TenantRow): Tenant {
  const businessName = row.business_name;
  const plan = row.plan?.toLowerCase();
  const subscription = row.subscription_status?.toLowerCase();

  return {
    id: row.id,
    name: businessName,
    slug: row.slug,
    businessType: row.business_type?.toLowerCase() === "ordering" ? "ordering" : "appointment",
    logo: row.logo ?? (businessName.charAt(0).toUpperCase() || "B"),
    logoBg: row.logo_bg ?? row.primary_color ?? "#8b5cf6",
    description: row.description ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    coverImage: row.cover_image ?? "",
    businessHours: [],
    socialLinks: {},
    primaryColor: row.primary_color ?? "#8b5cf6",
    accentColor: row.accent_color ?? "#a78bfa",
    createdAt: row.created_at ?? "",
    isActive: row.is_active && row.status.toUpperCase() === "ACTIVE",
    plan: plan === "pro" || plan === "enterprise" ? plan : "starter",
    stripeConnected: row.stripe_connected ?? false,
    subscriptionStatus:
      subscription === "active" ||
      subscription === "cancelled" ||
      subscription === "past_due"
        ? subscription
        : "trial",
    trialEndsAt: row.trial_ends_at ?? undefined,
  };
}

function emptyAnalytics(): AnalyticsSummary {
  return {
    totalRevenue: 0,
    totalActivity: 0,
    newCustomers: 0,
    avgOrderValue: 0,
    revenueChange: 0,
    activityChange: 0,
    topItems: [],
    revenueData: [],
  };
}

function addTopItem(
  itemsByTenant: Map<string, Map<string, TopItem>>,
  tenantId: string,
  name: string,
  count: number,
  revenue: number,
) {
  const tenantItems = itemsByTenant.get(tenantId) ?? new Map<string, TopItem>();
  const item = tenantItems.get(name) ?? { name, count: 0, revenue: 0 };
  item.count += count;
  item.revenue += revenue;
  tenantItems.set(name, item);
  itemsByTenant.set(tenantId, tenantItems);
}

async function loadData(tenantId?: string): Promise<AdminPlatformData> {
  const supabase = client();
  const tenantFilter = <T extends { eq: (column: string, value: string) => T }>(query: T) =>
    tenantId ? query.eq("tenant_id", tenantId) : query;

  const [tenantRows, orderRows, appointmentRows, customerRows] = await Promise.all([
    collectPages<TenantRow>(async (from, to) => {
      let query = supabase.from("tenants").select("*").order("created_at", { ascending: false });
      if (tenantId) query = query.eq("id", tenantId);
      const { data, error } = await query.range(from, to);
      return { data: data as TenantRow[] | null, error };
    }),
    collectPages<AdminOrderRow>(async (from, to) => {
      let query = supabase
        .from("orders")
        .select("id, tenant_id, status, total, created_at, order_items(product_name, quantity, subtotal)")
        .order("created_at", { ascending: false });
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return { data: data as unknown as AdminOrderRow[] | null, error };
    }),
    collectPages<AdminAppointmentRow>(async (from, to) => {
      let query = supabase
        .from("appointments")
        .select("id, tenant_id, status, total, subtotal, created_at, appointment_services(service_name, price)")
        .order("created_at", { ascending: false });
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return { data: data as unknown as AdminAppointmentRow[] | null, error };
    }),
    collectPages<AdminCustomerRow>(async (from, to) => {
      let query = supabase.from("customers").select("id, tenant_id").order("created_at", {
        ascending: false,
      });
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return { data: data as AdminCustomerRow[] | null, error };
    }),
  ]);

  const analyticsByTenant = new Map<string, AnalyticsSummary>();
  const itemsByTenant = new Map<string, Map<string, TopItem>>();
  const recognizedActivity = new Map<string, number>();
  const monthlyRevenue = new Map<string, number>();
  const monthCutoff = Date.now() - 30 * 86_400_000;

  for (const tenant of tenantRows) analyticsByTenant.set(tenant.id, emptyAnalytics());

  for (const customer of customerRows) {
    const analytics = analyticsByTenant.get(customer.tenant_id);
    if (analytics) analytics.newCustomers += 1;
  }

  for (const order of orderRows) {
    const analytics = analyticsByTenant.get(order.tenant_id);
    if (!analytics) continue;
    analytics.totalActivity += 1;
    const status = order.status.toUpperCase();
    const recognized = status === "DELIVERED" || status === "COMPLETED";
    const orderTotal = Number(order.total) || 0;
    if (recognized) {
      analytics.totalRevenue += orderTotal;
      recognizedActivity.set(order.tenant_id, (recognizedActivity.get(order.tenant_id) ?? 0) + 1);
      if (new Date(order.created_at).getTime() >= monthCutoff) {
        monthlyRevenue.set(order.tenant_id, (monthlyRevenue.get(order.tenant_id) ?? 0) + orderTotal);
      }
    }
    if (status === "CANCELLED") continue;
    for (const item of order.order_items ?? []) {
      addTopItem(
        itemsByTenant,
        order.tenant_id,
        item.product_name,
        Number(item.quantity) || 0,
        recognized ? Number(item.subtotal) || 0 : 0,
      );
    }
  }

  for (const appointment of appointmentRows) {
    const analytics = analyticsByTenant.get(appointment.tenant_id);
    if (!analytics) continue;
    analytics.totalActivity += 1;
    const status = appointment.status.toUpperCase();
    const recognized = status === "COMPLETED";
    const services = appointment.appointment_services ?? [];
    const appointmentTotal = Number(appointment.total ?? appointment.subtotal) ||
      services.reduce((sum, service) => sum + (Number(service.price) || 0), 0);
    if (recognized) {
      analytics.totalRevenue += appointmentTotal;
      recognizedActivity.set(
        appointment.tenant_id,
        (recognizedActivity.get(appointment.tenant_id) ?? 0) + 1,
      );
      if (new Date(appointment.created_at).getTime() >= monthCutoff) {
        monthlyRevenue.set(
          appointment.tenant_id,
          (monthlyRevenue.get(appointment.tenant_id) ?? 0) + appointmentTotal,
        );
      }
    }
    if (status === "CANCELLED") continue;
    for (const service of services) {
      addTopItem(
        itemsByTenant,
        appointment.tenant_id,
        service.service_name,
        1,
        recognized ? Number(service.price) || 0 : 0,
      );
    }
  }

  for (const [id, analytics] of analyticsByTenant) {
    const recognizedCount = recognizedActivity.get(id) ?? 0;
    analytics.avgOrderValue = recognizedCount ? analytics.totalRevenue / recognizedCount : 0;
    analytics.topItems = [...(itemsByTenant.get(id)?.values() ?? [])]
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 5);
  }

  const tenants = tenantRows.map((row) => ({
    ...mapTenant(row),
    monthlyRevenue: monthlyRevenue.get(row.id) ?? 0,
  }));
  const analyticsRecord = Object.fromEntries(analyticsByTenant);

  return {
    tenants,
    analyticsByTenant: analyticsRecord,
    totalRevenue: Object.values(analyticsRecord).reduce(
      (sum, analytics) => sum + analytics.totalRevenue,
      0,
    ),
    totalActivity: orderRows.length + appointmentRows.length,
    totalCustomers: customerRows.length,
  };
}

export function loadAdminPlatformData() {
  return loadData();
}

export async function loadAdminTenantData(tenantId: string): Promise<AdminTenantData | null> {
  const data = await loadData(tenantId);
  const tenant = data.tenants[0];
  if (!tenant) return null;
  return { tenant, analytics: data.analyticsByTenant[tenant.id] ?? emptyAnalytics() };
}
