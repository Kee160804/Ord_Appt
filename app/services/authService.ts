import type { SupabaseClient, User as SupabaseUser } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";
import type { BusinessType, Tenant, User, UserRole } from "@/app/types/index";
import type {
  BusinessHourRow,
  MembershipRow,
  ProfileRow,
  TenantRow,
} from "@/app/types/supabase";

export interface AuthenticatedAppSession {
  user: User;
  tenant: Tenant | null;
}

export interface AuthResult extends Partial<AuthenticatedAppSession> {
  error?: string;
  requiresEmailConfirmation?: boolean;
}

interface SignupBusinessMetadata {
  full_name: string;
  business_name: string;
  business_type: BusinessType;
  business_city: string;
  business_phone: string;
  business_slug: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message;
  }
  return fallback;
}

function roleName(membership: MembershipRow | null) {
  if (!membership?.roles) return "STAFF";
  return Array.isArray(membership.roles)
    ? membership.roles[0]?.name ?? "STAFF"
    : membership.roles.name;
}

function mapRole(profile: ProfileRow, membership: MembershipRow | null): UserRole {
  if (profile.platform_role?.toUpperCase() === "SUPER_ADMIN") return "superadmin";

  switch (roleName(membership).toUpperCase()) {
    case "OWNER":
      return "owner";
    case "ADMIN":
      return "admin";
    case "MANAGER":
      return "manager";
    default:
      return "staff";
  }
}

function mapUser(profile: ProfileRow, membership: MembershipRow | null): User {
  const name = profile.full_name?.trim() || profile.email?.split("@")[0] || "User";
  return {
    id: profile.id,
    tenantId: membership?.tenant_id ?? null,
    name,
    email: profile.email ?? "",
    role: mapRole(profile, membership),
    avatar: name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join(""),
    createdAt: profile.created_at ?? new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };
}

function normalizeBusinessType(value: string | null | undefined): BusinessType {
  return value?.toLowerCase() === "ordering" ? "ordering" : "appointment";
}

function mapTenant(row: TenantRow, hours: BusinessHourRow[]): Tenant {
  const businessName = row.business_name;
  const businessHours = [...hours]
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((hour) => ({
      day: DAYS[hour.day_of_week] ?? `Day ${hour.day_of_week}`,
      open: hour.open_time?.slice(0, 5) ?? "",
      close: hour.close_time?.slice(0, 5) ?? "",
      closed: hour.is_closed,
    }));

  return {
    id: row.id,
    name: businessName,
    slug: row.slug,
    businessType: normalizeBusinessType(row.business_type),
    logo: row.logo ?? businessName.charAt(0).toUpperCase(),
    logoBg: row.logo_bg ?? row.primary_color ?? "#8b5cf6",
    description: row.description ?? `Welcome to ${businessName}.`,
    phone: row.phone ?? "",
    email: row.email ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    coverImage:
      row.cover_image ??
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80",
    businessHours,
    socialLinks: {},
    primaryColor: row.primary_color ?? "#8b5cf6",
    accentColor: row.accent_color ?? "#a78bfa",
    createdAt: row.created_at ?? new Date().toISOString(),
    isActive: row.is_active && row.status.toUpperCase() === "ACTIVE",
    plan: row.plan === "pro" || row.plan === "enterprise" ? row.plan : "starter",
    stripeConnected: row.stripe_connected ?? false,
    subscriptionStatus:
      row.subscription_status === "active" ||
      row.subscription_status === "cancelled" ||
      row.subscription_status === "past_due"
        ? row.subscription_status
        : "trial",
    trialEndsAt: row.trial_ends_at ?? undefined,
  };
}

async function getMembership(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("id, tenant_id, profile_id, role_id, is_active, roles(name)")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as MembershipRow | null) ?? null;
}

function metadataFromUser(user: SupabaseUser): SignupBusinessMetadata | null {
  const metadata = user.user_metadata as Partial<SignupBusinessMetadata>;
  if (!metadata.business_name || !metadata.business_type) return null;

  return {
    full_name: metadata.full_name ?? user.email?.split("@")[0] ?? "Owner",
    business_name: metadata.business_name,
    business_type: metadata.business_type,
    business_city: metadata.business_city ?? "",
    business_phone: metadata.business_phone ?? "",
    business_slug: metadata.business_slug ?? "",
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function createAvailableSlug(supabase: SupabaseClient, requested: string) {
  const base = slugify(requested) || `business-${Date.now()}`;
  const { data, error } = await supabase
    .from("tenants")
    .select("slug, subdomain")
    .or(`slug.like.${base}%,subdomain.like.${base}%`);
  if (error) throw error;

  const existing = new Set(
    (data ?? []).flatMap((tenant) =>
      [tenant.slug, tenant.subdomain]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.toLowerCase()),
    ),
  );
  if (!existing.has(base)) return base;

  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

async function provisionTenantFromMetadata(supabase: SupabaseClient, authUser: SupabaseUser) {
  const metadata = metadataFromUser(authUser);
  if (!metadata) return null;

  const slug = await createAvailableSlug(
    supabase,
    metadata.business_slug || metadata.business_name,
  );
  const { data, error } = await supabase
    .from("tenants")
    .insert({
      business_name: metadata.business_name.trim(),
      slug,
      subdomain: slug,
      business_type: metadata.business_type,
      city: metadata.business_city.trim(),
      phone: metadata.business_phone.trim(),
      email: authUser.email ?? "",
      created_by: authUser.id,
      status: "ACTIVE",
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw error;

  await supabase
    .from("business_modules")
    .update({
      appointments: metadata.business_type === "appointment",
      ordering: metadata.business_type === "ordering",
      inventory: metadata.business_type === "ordering",
    })
    .eq("tenant_id", data.id);

  return data.id as string;
}

export async function loadAuthenticatedAppSession(
  suppliedAuthUser?: SupabaseUser,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase is not configured." };

  try {
    let authUser = suppliedAuthUser;
    if (!authUser) {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return { error: error?.message ?? "Not authenticated." };
      authUser = data.user;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (profileError || !profileData) {
      return { error: profileError?.message ?? "Your application profile was not found." };
    }

    const profile = profileData as ProfileRow;
    if (!profile.is_active) return { error: "This account has been deactivated." };

    let membership = await getMembership(supabase, profile.id);
    if (!membership && profile.platform_role?.toUpperCase() !== "SUPER_ADMIN") {
      const tenantId = await provisionTenantFromMetadata(supabase, authUser);
      if (tenantId) membership = await getMembership(supabase, profile.id);
    }

    const user = mapUser(profile, membership);
    if (!membership) return { user, tenant: null };

    const [{ data: tenantData, error: tenantError }, { data: hoursData, error: hoursError }] =
      await Promise.all([
        supabase.from("tenants").select("*").eq("id", membership.tenant_id).single(),
        supabase
          .from("business_hours")
          .select("day_of_week, open_time, close_time, is_closed")
          .eq("tenant_id", membership.tenant_id),
      ]);

    if (tenantError || !tenantData) {
      return { error: tenantError?.message ?? "Your business could not be loaded." };
    }
    if (hoursError) return { error: hoursError.message };

    return {
      user,
      tenant: mapTenant(tenantData as TenantRow, (hoursData ?? []) as BusinessHourRow[]),
    };
  } catch (error) {
    return { error: errorMessage(error, "Unable to load your account.") };
  }
}

export async function supabaseLogin(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: error?.message ?? "Invalid email or password." };

  return loadAuthenticatedAppSession(data.user);
}

export async function supabaseSignup(
  email: string,
  password: string,
  name: string,
  businessName: string,
  businessType: BusinessType,
  city: string,
  phone: string,
  slug: string,
): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const metadata: SignupBusinessMetadata = {
    full_name: name.trim(),
    business_name: businessName.trim(),
    business_type: businessType,
    business_city: city.trim(),
    business_phone: phone.trim(),
    business_slug: slugify(slug || businessName),
  };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error || !data.user) return { error: error?.message ?? "Unable to create account." };
  if (!data.session) return { requiresEmailConfirmation: true };

  return loadAuthenticatedAppSession(data.user);
}

export async function supabaseLogout() {
  const supabase = getSupabaseBrowserClient();
  if (supabase) await supabase.auth.signOut();
}
