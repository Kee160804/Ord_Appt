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

interface AdminProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  platform_role: string | null;
  is_active: boolean;
  created_at: string | null;
}

interface AdminMembershipRow {
  id: string;
  tenant_id: string;
  profile_id: string;
  role_id: string;
  is_active: boolean;
}

interface AdminRoleRow {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  is_system_role: boolean;
}

export interface AdminAgentRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string | null;
  tenantName: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminRoleSummary {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  userCount: number;
  tenantCount: number;
}

export interface AdminRevenuePoint {
  date: string;
  revenue: number;
  activity: number;
}

export interface AdminActivityRecord {
  id: string;
  type: "tenant" | "order" | "appointment";
  title: string;
  description: string;
  createdAt: string;
  tenantName: string;
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
  totalUsers: number;
  agents: AdminAgentRecord[];
  roles: AdminRoleSummary[];
  revenueSeries: AdminRevenuePoint[];
  recentActivity: AdminActivityRecord[];
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
    businessType:
      row.business_type?.toLowerCase() === "ordering"
        ? "ordering"
        : "appointment",
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
  const tenantFilter = <T extends { eq: (column: string, value: string) => T }>(
    query: T,
  ) => (tenantId ? query.eq("tenant_id", tenantId) : query);

  const [
    tenantRows,
    orderRows,
    appointmentRows,
    customerRows,
    profileRows,
    membershipRows,
    roleRows,
  ] = await Promise.all([
    collectPages<TenantRow>(async (from, to) => {
      let query = supabase
        .from("tenants")
        .select("*")
        .order("created_at", { ascending: false });
      if (tenantId) query = query.eq("id", tenantId);
      const { data, error } = await query.range(from, to);
      return { data: data as TenantRow[] | null, error };
    }),
    collectPages<AdminOrderRow>(async (from, to) => {
      let query = supabase
        .from("orders")
        .select(
          "id, tenant_id, status, total, created_at, order_items(product_name, quantity, subtotal)",
        )
        .order("created_at", { ascending: false });
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return { data: data as unknown as AdminOrderRow[] | null, error };
    }),
    collectPages<AdminAppointmentRow>(async (from, to) => {
      let query = supabase
        .from("appointments")
        .select(
          "id, tenant_id, status, total, subtotal, created_at, appointment_services(service_name, price)",
        )
        .order("created_at", { ascending: false });
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return { data: data as unknown as AdminAppointmentRow[] | null, error };
    }),
    collectPages<AdminCustomerRow>(async (from, to) => {
      let query = supabase
        .from("customers")
        .select("id, tenant_id")
        .order("created_at", {
          ascending: false,
        });
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return { data: data as AdminCustomerRow[] | null, error };
    }),
    collectPages<AdminProfileRow>(async (from, to) => {
      const query = supabase
        .from("profiles")
        .select("id, full_name, email, platform_role, is_active, created_at")
        .order("created_at", { ascending: false });
      const { data, error } = await query.range(from, to);
      return { data: data as AdminProfileRow[] | null, error };
    }),
    collectPages<AdminMembershipRow>(async (from, to) => {
      let query = supabase
        .from("tenant_memberships")
        .select("id, tenant_id, profile_id, role_id, is_active");
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return { data: data as AdminMembershipRow[] | null, error };
    }),
    collectPages<AdminRoleRow>(async (from, to) => {
      let query = supabase
        .from("roles")
        .select("id, tenant_id, name, description, is_system_role");
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return { data: data as AdminRoleRow[] | null, error };
    }),
  ]);

  const analyticsByTenant = new Map<string, AnalyticsSummary>();
  const itemsByTenant = new Map<string, Map<string, TopItem>>();
  const recognizedActivity = new Map<string, number>();
  const monthlyRevenue = new Map<string, number>();
  const monthCutoff = Date.now() - 30 * 86_400_000;

  for (const tenant of tenantRows)
    analyticsByTenant.set(tenant.id, emptyAnalytics());

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
      recognizedActivity.set(
        order.tenant_id,
        (recognizedActivity.get(order.tenant_id) ?? 0) + 1,
      );
      if (new Date(order.created_at).getTime() >= monthCutoff) {
        monthlyRevenue.set(
          order.tenant_id,
          (monthlyRevenue.get(order.tenant_id) ?? 0) + orderTotal,
        );
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
    const appointmentTotal =
      Number(appointment.total ?? appointment.subtotal) ||
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
    analytics.avgOrderValue = recognizedCount
      ? analytics.totalRevenue / recognizedCount
      : 0;
    analytics.topItems = [...(itemsByTenant.get(id)?.values() ?? [])]
      .sort((a, b) => b.count - a.count || b.revenue - a.revenue)
      .slice(0, 5);
  }

  const tenants = tenantRows.map((row) => ({
    ...mapTenant(row),
    monthlyRevenue: monthlyRevenue.get(row.id) ?? 0,
  }));
  const analyticsRecord = Object.fromEntries(analyticsByTenant);
  const tenantNameById = new Map(
    tenants.map((tenant) => [tenant.id, tenant.name]),
  );
  const roleById = new Map(roleRows.map((role) => [role.id, role]));
  const membershipsByProfile = new Map<string, AdminMembershipRow[]>();

  for (const membership of membershipRows) {
    const current = membershipsByProfile.get(membership.profile_id) ?? [];
    current.push(membership);
    membershipsByProfile.set(membership.profile_id, current);
  }

  const agents = profileRows
    .map<AdminAgentRecord>((profile) => {
      const membership = membershipsByProfile.get(profile.id)?.[0];
      const isSuperAdmin =
        profile.platform_role?.toUpperCase() === "SUPER_ADMIN";
      const role = membership ? roleById.get(membership.role_id) : undefined;
      return {
        id: profile.id,
        name:
          profile.full_name?.trim() ||
          profile.email?.split("@")[0] ||
          "Unnamed user",
        email: profile.email ?? "No email",
        role: isSuperAdmin ? "Super Admin" : (role?.name ?? "Unassigned"),
        tenantId: membership?.tenant_id ?? null,
        tenantName: membership
          ? (tenantNameById.get(membership.tenant_id) ?? "Unknown tenant")
          : isSuperAdmin
            ? "Platform"
            : "Unassigned",
        isActive: profile.is_active && (membership?.is_active ?? true),
        createdAt: profile.created_at ?? "",
      };
    })
    .filter((agent) => !tenantId || agent.tenantId === tenantId);

  const roleGroups = new Map<string, AdminRoleSummary>();
  for (const role of roleRows) {
    const key = role.name.trim().toUpperCase();
    const current = roleGroups.get(key) ?? {
      id: key.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: role.name,
      description: role.description ?? "Tenant access role",
      isSystem: role.is_system_role,
      userCount: 0,
      tenantCount: 0,
    };
    current.isSystem ||= role.is_system_role;
    roleGroups.set(key, current);
  }

  for (const [key, summary] of roleGroups) {
    const matchingRoles = new Set(
      roleRows
        .filter((role) => role.name.trim().toUpperCase() === key)
        .map((role) => role.id),
    );
    const matchingMemberships = membershipRows.filter((membership) =>
      matchingRoles.has(membership.role_id),
    );
    summary.userCount = new Set(
      matchingMemberships.map((membership) => membership.profile_id),
    ).size;
    summary.tenantCount = new Set(
      matchingMemberships.map((membership) => membership.tenant_id),
    ).size;
  }

  const superAdmins = profileRows.filter(
    (profile) => profile.platform_role?.toUpperCase() === "SUPER_ADMIN",
  );
  if (superAdmins.length && !tenantId) {
    roleGroups.set("SUPER_ADMIN", {
      id: "super-admin",
      name: "Super Admin",
      description: "Full platform access across all tenants",
      isSystem: true,
      userCount: superAdmins.length,
      tenantCount: tenants.length,
    });
  }

  const seriesByDate = new Map<string, AdminRevenuePoint>();
  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    seriesByDate.set(key, { date: key, revenue: 0, activity: 0 });
  }

  for (const order of orderRows) {
    const point = seriesByDate.get(order.created_at.slice(0, 10));
    if (!point) continue;
    point.activity += 1;
    if (["DELIVERED", "COMPLETED"].includes(order.status.toUpperCase())) {
      point.revenue += Number(order.total) || 0;
    }
  }
  for (const appointment of appointmentRows) {
    const point = seriesByDate.get(appointment.created_at.slice(0, 10));
    if (!point) continue;
    point.activity += 1;
    if (appointment.status.toUpperCase() === "COMPLETED") {
      const services = appointment.appointment_services ?? [];
      point.revenue +=
        Number(appointment.total ?? appointment.subtotal) ||
        services.reduce(
          (sum, service) => sum + (Number(service.price) || 0),
          0,
        );
    }
  }

  const recentActivity: AdminActivityRecord[] = [
    ...tenantRows.map((tenant) => ({
      id: `tenant-${tenant.id}`,
      type: "tenant" as const,
      title: "Business registered",
      description: `${tenant.business_name} joined the platform`,
      createdAt: tenant.created_at ?? "",
      tenantName: tenant.business_name,
    })),
    ...orderRows.map((order) => ({
      id: `order-${order.id}`,
      type: "order" as const,
      title: "Order placed",
      description: `Order ${order.id.slice(0, 8).toUpperCase()} was created`,
      createdAt: order.created_at,
      tenantName: tenantNameById.get(order.tenant_id) ?? "Unknown tenant",
    })),
    ...appointmentRows.map((appointment) => ({
      id: `appointment-${appointment.id}`,
      type: "appointment" as const,
      title: "Appointment booked",
      description: `Appointment ${appointment.id.slice(0, 8).toUpperCase()} was created`,
      createdAt: appointment.created_at,
      tenantName: tenantNameById.get(appointment.tenant_id) ?? "Unknown tenant",
    })),
  ]
    .filter((activity) => activity.createdAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 6);

  return {
    tenants,
    analyticsByTenant: analyticsRecord,
    totalRevenue: Object.values(analyticsRecord).reduce(
      (sum, analytics) => sum + analytics.totalRevenue,
      0,
    ),
    totalActivity: orderRows.length + appointmentRows.length,
    totalCustomers: customerRows.length,
    totalUsers: profileRows.length,
    agents,
    roles: [...roleGroups.values()].sort((a, b) => b.userCount - a.userCount),
    revenueSeries: [...seriesByDate.values()],
    recentActivity,
  };
}

export function loadAdminPlatformData() {
  return loadData();
}

export async function loadAdminTenantData(
  tenantId: string,
): Promise<AdminTenantData | null> {
  const data = await loadData(tenantId);
  const tenant = data.tenants[0];
  if (!tenant) return null;
  return {
    tenant,
    analytics: data.analyticsByTenant[tenant.id] ?? emptyAnalytics(),
  };
}

export async function updateAdminTenantSubscription(
  tenantId: string,
  plan: Tenant["plan"],
  status: Tenant["subscriptionStatus"],
  trialDays?: number,
) {
  const response = await fetch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/subscription`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, status, trialDays: trialDays ?? null }),
    },
  );
  const payload = (await response.json()) as {
    subscription?: Pick<Tenant, "plan" | "subscriptionStatus" | "trialEndsAt">;
    error?: string;
  };
  if (!response.ok || !payload.subscription) {
    throw new Error(payload.error || "Unable to update subscription access.");
  }
  return payload.subscription;
}

export interface CreateAdminTenantInput {
  businessName: string;
  businessType: "appointment" | "ordering";
  ownerName: string;
  ownerEmail: string;
  password?: string;
  city?: string;
  phone?: string;
  slug?: string;
  plan?: "starter" | "pro" | "enterprise";
  subscriptionStatus?: "trial" | "active";
  trialDays?: number;
  sendPasswordEmail?: boolean;
}

export interface CreateAdminTenantResult {
  success: boolean;
  tenant: {
    id: string;
    name: string;
    slug: string;
    businessType: "appointment" | "ordering";
    plan: "starter" | "pro" | "enterprise";
    subscriptionStatus: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  emailSent?: boolean;
  createdNewUser?: boolean;
}

export interface CreateAdminAgentInput {
  name: string;
  email: string;
  role: "superadmin" | "owner" | "admin" | "manager" | "staff";
  tenantId?: string | null;
  password?: string;
  sendPasswordEmail?: boolean;
}

export interface CreateAdminAgentResult {
  success: boolean;
  agent: {
    id: string;
    name: string;
    email: string;
    role: string;
    tenantId: string | null;
    tenantName: string;
    isActive: boolean;
  };
  emailSent?: boolean;
  createdNewUser?: boolean;
}

export async function createAdminTenant(
  input: CreateAdminTenantInput,
): Promise<CreateAdminTenantResult> {
  const response = await fetch("/api/admin/tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await response.json()) as CreateAdminTenantResult & {
    error?: string;
  };
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to create tenant.");
  }
  return data;
}

export async function createAdminAgent(
  input: CreateAdminAgentInput,
): Promise<CreateAdminAgentResult> {
  const response = await fetch("/api/admin/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await response.json()) as CreateAdminAgentResult & {
    error?: string;
  };
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to create agent.");
  }
  return data;
}
