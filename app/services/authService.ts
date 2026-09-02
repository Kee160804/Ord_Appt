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
  businesses: Tenant[];
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

export interface CreateBusinessInput {
  businessName: string;
  businessType: BusinessType;
  city: string;
  phone: string;
  slug: string;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const tenantProvisioningByUser = new Map<string, Promise<string | null>>();
const ACTIVE_BUSINESS_KEY_PREFIX = "yuhbusiness_active_business:";

function errorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error && error.message
    ? error.message
    : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
      ? error.message
      : "";
  if (message.includes("tenant_memberships_tenant_id_profile_id_key")) {
    return "Your account membership already exists but could not be loaded. Sign out, then sign in again. If this continues, ask the platform administrator to run the onboarding repair migration.";
  }
  if (message) return message;
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

async function getMemberships(supabase: SupabaseClient, profileId: string) {
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("id, tenant_id, profile_id, role_id, is_active, roles(name)")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });

  if (error) throw error;
  return (data as MembershipRow[] | null) ?? [];
}

function activeBusinessStorageKey(profileId: string) {
  return `${ACTIVE_BUSINESS_KEY_PREFIX}${profileId}`;
}

function getStoredActiveBusiness(profileId: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(activeBusinessStorageKey(profileId));
}

function storeActiveBusiness(profileId: string, tenantId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(activeBusinessStorageKey(profileId), tenantId);
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

async function createTenantFromMetadata(supabase: SupabaseClient, authUser: SupabaseUser) {
  const metadata = metadataFromUser(authUser);
  if (!metadata) return null;

  const { data, error } = await supabase.rpc("provision_owner_business", {
    p_business_name: metadata.business_name,
    p_business_type: metadata.business_type,
    p_city: metadata.business_city,
    p_phone: metadata.business_phone,
    p_slug: metadata.business_slug || metadata.business_name,
    p_full_name: metadata.full_name,
  });

  if (error) {
    if (error.code === "PGRST202") {
      throw new Error(
        "Account provisioning is not installed. Apply the owner onboarding migration in Supabase, then sign in again.",
      );
    }
    throw error;
  }
  return data as string;
}

async function provisionTenantFromMetadata(supabase: SupabaseClient, authUser: SupabaseUser) {
  const inFlightProvisioning = tenantProvisioningByUser.get(authUser.id);
  if (inFlightProvisioning) return inFlightProvisioning;

  const provisioning = createTenantFromMetadata(supabase, authUser);
  tenantProvisioningByUser.set(authUser.id, provisioning);

  try {
    return await provisioning;
  } finally {
    tenantProvisioningByUser.delete(authUser.id);
  }
}

export async function loadAuthenticatedAppSession(
  suppliedAuthUser?: SupabaseUser,
  requestedTenantId?: string,
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

    let { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    // A fresh Supabase project may not have an auth.users trigger. In that
    // case the authenticated provisioning RPC creates the profile, tenant,
    // OWNER role, and membership atomically before session hydration resumes.
    if (!profileData && metadataFromUser(authUser)) {
      await provisionTenantFromMetadata(supabase, authUser);
      const profileResult = await supabase
        .from("profiles")
        .select("*")
        .eq("id", authUser.id)
        .single();
      profileData = profileResult.data;
      profileError = profileResult.error;
    }

    if (profileError || !profileData) {
      return { error: profileError?.message ?? "Your application profile was not found." };
    }

    const profile = profileData as ProfileRow;
    if (!profile.is_active) return { error: "This account has been deactivated." };

    let memberships = await getMemberships(supabase, profile.id);
    if (memberships.length === 0 && profile.platform_role?.toUpperCase() !== "SUPER_ADMIN") {
      const tenantId = await provisionTenantFromMetadata(supabase, authUser);
      if (tenantId) memberships = await getMemberships(supabase, profile.id);
    }

    if (memberships.length === 0) {
      return { user: mapUser(profile, null), tenant: null, businesses: [] };
    }

    const tenantIds = memberships.map((membership) => membership.tenant_id);

    const [{ data: tenantData, error: tenantError }, { data: hoursData, error: hoursError }] =
      await Promise.all([
        supabase.from("tenants").select("*").in("id", tenantIds),
        supabase
          .from("business_hours")
          .select("tenant_id, day_of_week, open_time, close_time, is_closed")
          .in("tenant_id", tenantIds),
      ]);

    if (tenantError) return { error: tenantError.message };
    if (hoursError) return { error: hoursError.message };

    const tenantRows = (tenantData ?? []) as TenantRow[];
    const hourRows = (hoursData ?? []) as (BusinessHourRow & { tenant_id: string })[];
    const tenantById = new Map(
      tenantRows.map((row) => [
        row.id,
        mapTenant(row, hourRows.filter((hour) => hour.tenant_id === row.id)),
      ]),
    );
    const businesses = tenantIds
      .map((tenantId) => tenantById.get(tenantId))
      .filter((business): business is Tenant => Boolean(business));

    if (businesses.length === 0) {
      return { error: "None of your active business memberships could be loaded." };
    }

    const storedTenantId = getStoredActiveBusiness(profile.id);
    const desiredTenantId = requestedTenantId ?? storedTenantId;
    const tenant = businesses.find((business) => business.id === desiredTenantId) ?? businesses[0];
    const membership = memberships.find((candidate) => candidate.tenant_id === tenant.id) ?? null;
    const user = mapUser(profile, membership);
    storeActiveBusiness(profile.id, tenant.id);

    return {
      user,
      tenant,
      businesses,
    };
  } catch (error) {
    return { error: errorMessage(error, "Unable to load your account.") };
  }
}

export async function createAdditionalBusiness(input: CreateBusinessInput): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const businessName = input.businessName.trim();
  if (businessName.length < 2) return { error: "Business name is required." };

  try {
    const { data, error } = await supabase.rpc("create_additional_owner_business", {
      p_business_name: businessName,
      p_business_type: input.businessType,
      p_city: input.city.trim(),
      p_phone: input.phone.trim(),
      p_slug: slugify(input.slug || businessName),
    });

    if (error) {
      if (error.code === "PGRST202") {
        throw new Error(
          "Multi-business setup is not installed yet. Apply the multi-business migration in Supabase and try again.",
        );
      }
      throw error;
    }

    return loadAuthenticatedAppSession(undefined, data as string);
  } catch (error) {
    return { error: errorMessage(error, "Unable to add this business.") };
  }
}

export async function supabaseLogin(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return { error: "Supabase is not configured." };

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: error?.message ?? "Invalid email or password." };

  const result = await loadAuthenticatedAppSession(data.user);
  if (!result.user) {
    await supabase.auth.signOut({ scope: "local" });
  }
  return result;
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
  const emailRedirectTo = typeof window === "undefined"
    ? undefined
    : `${window.location.origin}/auth/confirm?next=/dashboard`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata, emailRedirectTo },
  });

  if (error || !data.user) return { error: error?.message ?? "Unable to create account." };
  if (!data.session) return { requiresEmailConfirmation: true };

  return loadAuthenticatedAppSession(data.user);
}

export async function supabaseLogout() {
  const supabase = getSupabaseBrowserClient();
  if (supabase) await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Password recovery is not configured for this deployment.");

  const redirectTo = typeof window === "undefined"
    ? undefined
    : `${window.location.origin}/auth/confirm?next=/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo,
  });
  if (error) throw new Error(errorMessage(error, "Unable to send the password reset email."));
}

export async function resendSignupConfirmation(email: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Email confirmation is not configured for this deployment.");
  const emailRedirectTo = typeof window === "undefined"
    ? undefined
    : `${window.location.origin}/auth/confirm?next=/dashboard`;
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo },
  });
  if (error) throw new Error(errorMessage(error, "Unable to resend the confirmation email."));
}

export async function updateAccountPassword(password: string) {
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Password recovery is not configured for this deployment.");

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    throw new Error("This password reset link is invalid or has expired. Request a new link.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(errorMessage(error, "Unable to update your password."));
}
