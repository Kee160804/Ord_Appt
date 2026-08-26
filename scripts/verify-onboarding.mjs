import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // CI normally injects environment variables and may not have .env.local.
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "ONBOARDING_TEST_EMAIL",
  "ONBOARDING_TEST_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing onboarding test environment variables: ${missing.join(", ")}`);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
  email: process.env.ONBOARDING_TEST_EMAIL,
  password: process.env.ONBOARDING_TEST_PASSWORD,
});
if (signInError || !signIn.user) throw signInError ?? new Error("Test user did not sign in.");

const metadata = signIn.user.user_metadata ?? {};
const { error: provisionError } = await supabase.rpc("provision_owner_business", {
  p_business_name: metadata.business_name,
  p_business_type: metadata.business_type,
  p_city: metadata.business_city ?? "",
  p_phone: metadata.business_phone ?? "",
  p_slug: metadata.business_slug || metadata.business_name,
  p_full_name: metadata.full_name || process.env.ONBOARDING_TEST_EMAIL.split("@")[0],
});
if (provisionError) throw provisionError;

const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("id,is_active")
  .eq("id", signIn.user.id)
  .single();
if (profileError || !profile?.is_active) {
  throw profileError ?? new Error("Fresh auth user has no active profile.");
}

const { data: membership, error: membershipError } = await supabase
  .from("tenant_memberships")
  .select("tenant_id,is_active,roles(name),tenants(id,is_active,status)")
  .eq("profile_id", signIn.user.id)
  .eq("is_active", true)
  .single();
if (membershipError) throw membershipError;
const role = Array.isArray(membership.roles) ? membership.roles[0] : membership.roles;
const tenant = Array.isArray(membership.tenants) ? membership.tenants[0] : membership.tenants;
if (role?.name?.toUpperCase() !== "OWNER") throw new Error("Fresh user does not have the OWNER role.");
if (!tenant?.is_active || tenant.status !== "ACTIVE") throw new Error("Fresh user has no active tenant.");

console.log(`Onboarding verification passed for auth user ${signIn.user.id} and tenant ${membership.tenant_id}.`);
