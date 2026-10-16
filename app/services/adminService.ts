import { requireSupabaseBrowserClient as client } from "@/app/lib/supabase/client";
import type { Tenant } from "@/app/types/index";
import type { TenantRow } from "@/app/types/supabase";
import { parseSocialLinks } from "@/app/lib/social-links";

const PAGE_SIZE = 1000;

interface QueryError {
  message: string;
}

interface PageResult<T> {
  data: T[] | null;
  error: QueryError | null;
}

interface AdminSubscriptionPaymentRow {
  id: string;
  tenant_id: string;
  status: string;
  kind: string;
  amount: number | string;
  refunded_amount: number | string;
  currency: string;
  provider: string;
  paid_at: string | null;
  created_at: string;
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
  status: "active" | "inactive" | "pending";
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
  type: "tenant" | "subscription";
  title: string;
  description: string;
  createdAt: string;
  tenantName: string;
}

export interface AdminTenantData {
  tenant: Tenant;
  hasVerifiedPayment: boolean;
}

export interface AdminPlatformData {
  tenants: Tenant[];
  paidTenantIds: string[];
  subscriptionRevenue: number;
  monthlyRecurringRevenue: number;
  activeSubscriptions: number;
  subscriptionPayments: number;
  totalUsers: number;
  agents: AdminAgentRecord[];
  roles: AdminRoleSummary[];
  revenueSeries: AdminRevenuePoint[];
  recentActivity: AdminActivityRecord[];
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
    domain: row.custom_domain_verified_at
      ? (row.custom_domain ?? undefined)
      : undefined,
    customDomain: row.custom_domain ?? undefined,
    customDomainVerified: Boolean(row.custom_domain_verified_at),
    businessType:
      row.business_type?.toLowerCase() === "ordering"
        ? "ordering"
        : row.business_type?.toLowerCase() === "retail"
          ? "retail"
          : "appointment",
    logo: row.logo ?? (businessName.charAt(0).toUpperCase() || "B"),
    logoImage: row.logo_url ?? undefined,
    logoBg: row.logo_bg ?? row.primary_color ?? "#8b5cf6",
    description: row.description ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    coverImage: row.cover_image ?? "",
    coverImagePositionX: row.cover_image_position_x ?? 50,
    coverImagePositionY: row.cover_image_position_y ?? 50,
    coverImageZoom: row.cover_image_zoom ?? 100,
    businessHours: [],
    socialLinks: parseSocialLinks(row.social_links),
    primaryColor: row.primary_color ?? "#8b5cf6",
    accentColor: row.accent_color ?? "#a78bfa",
    createdAt: row.created_at ?? "",
    isActive: row.is_active && row.status.toUpperCase() === "ACTIVE",
    plan: plan === "pro" || plan === "enterprise" ? plan : "starter",
    stripeConnected: row.stripe_connected ?? false,
    subscriptionStatus:
      subscription === "active" ||
      subscription === "cancelled" ||
      subscription === "canceled" ||
      subscription === "past_due" ||
      subscription === "expired" ||
      subscription === "trialing"
        ? subscription
        : "trial",
    trialEndsAt: row.trial_ends_at ?? undefined,
    currentPeriodStart: row.current_period_start ?? undefined,
    currentPeriodEnd: row.current_period_end ?? undefined,
    cancelAtPeriodEnd: row.cancel_at_period_end ?? false,
    canceledAt: row.canceled_at ?? undefined,
    providerCustomerId: row.provider_customer_id ?? undefined,
    providerSubscriptionId: row.provider_subscription_id ?? undefined,
    subscriptionBaseAmount: Number(row.subscription_base_amount ?? 0),
    subscriptionSeatAmount: Number(row.subscription_seat_amount ?? 0),
    subscriptionRecurringTotal: Number(row.subscription_recurring_total ?? 0),
    subscriptionPaidStaffSeats: row.subscription_paid_staff_seats ?? 0,
  };
}

async function loadData(tenantId?: string): Promise<AdminPlatformData> {
  const supabase = client();
  const tenantFilter = <T extends { eq: (column: string, value: string) => T }>(
    query: T,
  ) => (tenantId ? query.eq("tenant_id", tenantId) : query);

  const [
    tenantRows,
    subscriptionPaymentRows,
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
    collectPages<AdminSubscriptionPaymentRow>(async (from, to) => {
      let query = supabase
        .from("payment_transactions")
        .select(
          "id,tenant_id,status,kind,amount,refunded_amount,currency,provider,paid_at,created_at",
        )
        .eq("kind", "SUBSCRIPTION")
        .order("created_at", { ascending: false });
      query = tenantFilter(query);
      const { data, error } = await query.range(from, to);
      return {
        data: data as AdminSubscriptionPaymentRow[] | null,
        error,
      };
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

  const tenants = tenantRows.map(mapTenant);
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
      const isActive = profile.is_active && (membership?.is_active ?? true);
      const status = !isActive
        ? "inactive"
        : !isSuperAdmin && !membership
          ? "pending"
          : "active";
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
        isActive,
        status,
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

  const liveSubscriptionPayments = subscriptionPaymentRows.filter(
    (payment) => payment.provider.toUpperCase() === "BELIZE_BANK",
  );
  const recognizedSubscriptionPayments = liveSubscriptionPayments.filter(
    (payment) =>
      ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
        payment.status.toUpperCase(),
      ) && Boolean(payment.paid_at),
  );
  const paidTenantIds = new Set(
    recognizedSubscriptionPayments
      .filter((payment) =>
        ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(
          payment.status.toUpperCase(),
        ),
      )
      .map((payment) => payment.tenant_id),
  );

  for (const payment of liveSubscriptionPayments) {
    const occurredAt = payment.paid_at ?? payment.created_at;
    const point = seriesByDate.get(occurredAt.slice(0, 10));
    if (!point) continue;
    point.activity += 1;
    if (
      ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(
        payment.status.toUpperCase(),
      )
    ) {
      point.revenue += Math.max(
        0,
        (Number(payment.amount) || 0) - (Number(payment.refunded_amount) || 0),
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
    ...liveSubscriptionPayments.map((payment) => ({
      id: `subscription-${payment.id}`,
      type: "subscription" as const,
      title: `Subscription payment ${payment.status.toLowerCase()}`,
      description: `${Number(payment.amount) || 0} ${payment.currency} via ${payment.provider}`,
      createdAt: payment.paid_at ?? payment.created_at,
      tenantName:
        tenantNameById.get(payment.tenant_id) ?? "Unknown subscription",
    })),
  ]
    .filter((activity) => activity.createdAt)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 6);

  const paidTenants = tenants.filter(
    (tenant) =>
      tenant.subscriptionStatus === "active" &&
      paidTenantIds.has(tenant.id) &&
      (tenant.subscriptionRecurringTotal ?? 0) > 0,
  );
  const subscriptionRevenue = recognizedSubscriptionPayments.reduce(
    (sum, payment) =>
      sum +
      Math.max(
        0,
        (Number(payment.amount) || 0) - (Number(payment.refunded_amount) || 0),
      ),
    0,
  );

  return {
    tenants,
    paidTenantIds: [...paidTenantIds],
    subscriptionRevenue,
    monthlyRecurringRevenue: paidTenants.reduce(
      (sum, tenant) => sum + (tenant.subscriptionRecurringTotal ?? 0),
      0,
    ),
    activeSubscriptions: paidTenants.length,
    subscriptionPayments: liveSubscriptionPayments.length,
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
    hasVerifiedPayment: data.paidTenantIds.includes(tenant.id),
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

export async function updateAdminDomainVerification(
  tenantId: string,
  verified: boolean,
) {
  const response = await fetch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}/domain`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified }),
    },
  );
  const payload = (await response.json()) as {
    domain?: string;
    verified?: boolean;
    error?: string;
  };
  if (!response.ok || typeof payload.verified !== "boolean") {
    throw new Error(payload.error || "Unable to update domain verification.");
  }
  return { domain: payload.domain ?? "", verified: payload.verified };
}

export interface CreateAdminTenantInput {
  businessName: string;
  businessType: "appointment" | "ordering" | "retail";
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
    businessType: "appointment" | "ordering" | "retail";
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

/**
 * Roles supported by the platform Agent Management API.
 *
 * SECURITY:
 * - "superadmin" is platform-scoped.
 * - All other roles are tenant-scoped and require a tenantId.
 * - The protected server API remains the final authorization authority.
 */
type AdminAgentRole = "superadmin" | "owner" | "admin" | "manager" | "staff";

export interface CreateAdminAgentInput {
  name: string;
  email: string;
  role: AdminAgentRole;
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
    status?: "active" | "inactive" | "pending";
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

export interface DeleteAdminTenantResult {
  success: boolean;
  deletedTenant: {
    id: string;
    name: string;
  };
  removedAccountIds: string[];
  retainedAccountIds: string[];
  cleanupWarnings: string[];
}

export async function deleteAdminTenant(
  tenantId: string,
): Promise<DeleteAdminTenantResult> {
  const response = await fetch(
    `/api/admin/tenants/${encodeURIComponent(tenantId)}`,
    { method: "DELETE" },
  );
  const data = (await response.json()) as DeleteAdminTenantResult & {
    error?: string;
  };

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to delete tenant.");
  }

  return data;
}

export async function createAdminAgent(
  input: CreateAdminAgentInput,
): Promise<CreateAdminAgentResult> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const tenantId =
    typeof input.tenantId === "string" && input.tenantId.trim()
      ? input.tenantId.trim()
      : null;

  if (name.length < 2) {
    throw new Error("Agent full name is required.");
  }

  if (!email) {
    throw new Error("Agent email address is required.");
  }

  const isSuperAdmin = input.role === "superadmin";

  if (!isSuperAdmin && !tenantId) {
    throw new Error(
      "A business tenant is required for owner, admin, manager, and staff accounts.",
    );
  }

  if (isSuperAdmin && tenantId) {
    throw new Error(
      "Platform super admins cannot be assigned to a tenant during creation.",
    );
  }

  const response = await fetch("/api/admin/agents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...input,
      name,
      email,
      tenantId,
    }),
  });

  let data: (CreateAdminAgentResult & { error?: string }) | null = null;

  try {
    data = (await response.json()) as CreateAdminAgentResult & {
      error?: string;
    };
  } catch {
    throw new Error(
      "The server returned an invalid response while creating the agent.",
    );
  }

  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Unable to create agent. Please try again.");
  }

  return data;
}

export async function deleteAdminAgent(agentId: string): Promise<void> {
  const response = await fetch(
    `/api/admin/agents/${encodeURIComponent(agentId)}`,
    { method: "DELETE" },
  );
  const data = (await response.json()) as {
    success?: boolean;
    error?: string;
  };

  if (!response.ok || !data.success) {
    throw new Error(data.error || "Unable to delete account.");
  }
}
