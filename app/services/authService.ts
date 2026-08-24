import type { BusinessType, Tenant, User } from "@/app/types/index";
import { getSupabaseClient, isSupabaseEnabled } from "@/app/lib/supabase";

interface SupabaseProfile {
  id: string;
  auth_user_id: string;
  tenant_id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  created_at?: string;
  last_login?: string;
}

interface SupabaseAuthResult {
  data: { user: { id: string } } | null;
  error: { message?: string } | null;
}

function mapProfileToUser(profile: SupabaseProfile): User {
  return {
    id: profile.auth_user_id,
    email: profile.email,
    name: profile.name,
    role: profile.role as User["role"],
    tenantId: profile.tenant_id,
    avatar: profile.avatar || profile.name?.charAt(0).toUpperCase() || "U",
    createdAt: profile.created_at || new Date().toISOString().split("T")[0],
    lastLogin: profile.last_login || new Date().toISOString().split("T")[0],
  };
}

export async function supabaseLogin(email: string, password: string): Promise<{ user?: User; error?: string }> {
  if (!isSupabaseEnabled()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase client unavailable." };
  }

  const result = await supabase.auth.signInWithPassword({ email, password }) as SupabaseAuthResult;
  if (result.error || !result.data?.user) {
    return { error: result.error?.message ?? "Failed to sign in with Supabase." };
  }

  const authUser = result.data.user;
  const profile = await supabase
    .from<SupabaseProfile>("profiles")
    .select("*")
    .eq("auth_user_id", authUser.id)
    .single();

  if (profile.error || !profile.data) {
    return { error: "Supabase profile not found for authenticated user." };
  }

  return { user: mapProfileToUser(profile.data) };
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
): Promise<{ user?: User; tenant?: Tenant; error?: string }> {
  if (!isSupabaseEnabled()) {
    return { error: "Supabase is not configured." };
  }

  const supabase = await getSupabaseClient();
  if (!supabase) {
    return { error: "Supabase client unavailable." };
  }

  const signUpResult = await supabase.auth.signUp({ email, password }) as SupabaseAuthResult;
  if (signUpResult.error || !signUpResult.data?.user) {
    return { error: signUpResult.error?.message ?? "Failed to sign up with Supabase." };
  }

  const authUser = signUpResult.data.user;
  const tenantId = `tenant-${Date.now()}`;
  const tenantSlug = slug.trim() || businessName.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const tenant: Tenant = {
    id: tenantId,
    name: businessName.trim(),
    slug: tenantSlug,
    businessType,
    logo: businessName.trim().charAt(0).toUpperCase() || "B",
    logoBg: "#8b5cf6",
    description: `Welcome to ${businessName.trim()}!`,
    phone: phone.trim(),
    email,
    address: "",
    city: city.trim(),
    coverImage: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1200&q=80",
    businessHours: [
      { day: "Monday", open: "09:00", close: "18:00", closed: false },
      { day: "Tuesday", open: "09:00", close: "18:00", closed: false },
      { day: "Wednesday", open: "09:00", close: "18:00", closed: false },
      { day: "Thursday", open: "09:00", close: "18:00", closed: false },
      { day: "Friday", open: "09:00", close: "18:00", closed: false },
      { day: "Saturday", open: "10:00", close: "16:00", closed: false },
      { day: "Sunday", open: "", close: "", closed: true },
    ],
    socialLinks: {},
    primaryColor: "#8b5cf6",
    accentColor: "#a78bfa",
    createdAt: new Date().toISOString().split("T")[0],
    isActive: true,
    plan: "starter",
    stripeConnected: false,
    subscriptionStatus: "trial",
    trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };

  const profile: SupabaseProfile = {
    id: authUser.id,
    auth_user_id: authUser.id,
    tenant_id: tenantId,
    email,
    name: name.trim(),
    role: "owner",
    avatar: name.trim().charAt(0).toUpperCase() || "U",
    created_at: new Date().toISOString().split("T")[0],
    last_login: new Date().toISOString().split("T")[0],
  };

  const { error: tenantError } = await supabase.from<Tenant>("tenants").insert([tenant]);
  if (tenantError) {
    return { error: tenantError.message ?? "Failed to create tenant." };
  }

  const { error: profileError } = await supabase.from<SupabaseProfile>("profiles").insert([profile]);
  if (profileError) {
    return { error: profileError.message ?? "Failed to create profile." };
  }

  return { user: mapProfileToUser(profile), tenant };
}
