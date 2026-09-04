import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // CI normally injects environment variables and may not have .env.local.
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "ENTITLEMENT_TEST_OWNER_EMAIL",
  "ENTITLEMENT_TEST_OWNER_PASSWORD",
  "ENTITLEMENT_TEST_EXPIRED_EMAIL",
  "ENTITLEMENT_TEST_EXPIRED_PASSWORD",
  "ENTITLEMENT_TEST_EXPIRED_PRODUCT_ID",
  "ENTITLEMENT_TEST_EXPIRED_SERVICE_ID",
  "ENTITLEMENT_TEST_APPOINTMENT_DATE",
  "ENTITLEMENT_TEST_APPOINTMENT_TIME",
  "ENTITLEMENT_TEST_SUPER_ADMIN_EMAIL",
  "ENTITLEMENT_TEST_SUPER_ADMIN_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(
    `Missing entitlement test environment variables: ${missing.join(", ")}`,
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const owner = createClient(url, key, options);
const expiredOwner = createClient(url, key, options);
const superAdmin = createClient(url, key, options);
const anonymous = createClient(url, key, options);

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function tenantIdFor(client) {
  const { data, error } = await client
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (error) throw error;
  return data.tenant_id;
}

async function expectRejected(label, promise, messagePart) {
  const { error } = await promise;
  if (!error) throw new Error(`${label} unexpectedly succeeded.`);
  if (
    messagePart &&
    !error.message.toLowerCase().includes(messagePart.toLowerCase())
  ) {
    throw new Error(`${label} failed for the wrong reason: ${error.message}`);
  }
}

await signIn(
  owner,
  process.env.ENTITLEMENT_TEST_OWNER_EMAIL,
  process.env.ENTITLEMENT_TEST_OWNER_PASSWORD,
);
const ownerTenantId = await tenantIdFor(owner);
const { data: usageRows, error: usageError } = await owner.rpc(
  "get_tenant_monthly_usage",
  {
    p_tenant_id: ownerTenantId,
  },
);
if (usageError) throw usageError;
const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
const expectedLimit =
  usage.plan === "enterprise" ? null : usage.plan === "pro" ? 150 : 50;
if (!usage || usage.activity_limit !== expectedLimit) {
  throw new Error(`Unexpected ${usage?.plan ?? "unknown"} activity limit.`);
}

await expectRejected(
  "regular owner subscription administration",
  owner.rpc("set_tenant_subscription", {
    p_tenant_id: ownerTenantId,
    p_plan: "__verification_invalid__",
    p_subscription_status: "active",
    p_trial_days: null,
  }),
  "platform administrator",
);

await signIn(
  expiredOwner,
  process.env.ENTITLEMENT_TEST_EXPIRED_EMAIL,
  process.env.ENTITLEMENT_TEST_EXPIRED_PASSWORD,
);
const expiredTenantId = await tenantIdFor(expiredOwner);
const { data: accessAllowed, error: accessError } = await expiredOwner.rpc(
  "tenant_subscription_allows_access",
  { p_tenant_id: expiredTenantId },
);
if (accessError) throw accessError;
if (accessAllowed !== false)
  throw new Error("Expired tenant still has subscription access.");

for (const table of [
  "products",
  "services",
  "customers",
  "orders",
  "appointments",
]) {
  const { data, error } = await expiredOwner
    .from(table)
    .select("tenant_id")
    .eq("tenant_id", expiredTenantId)
    .limit(1);
  if (error) throw error;
  if (data.length !== 0)
    throw new Error(`Expired tenant can still read ${table}.`);
}

await expectRejected(
  "expired storefront order",
  anonymous.rpc("create_public_order", {
    p_tenant_id: expiredTenantId,
    p_customer_name: "Expired Trial Verification",
    p_customer_phone: "+15555550131",
    p_order_type: "pickup",
    p_items: [
      {
        product_id: process.env.ENTITLEMENT_TEST_EXPIRED_PRODUCT_ID,
        quantity: 1,
        addons: [],
      },
    ],
    p_notes: "Entitlement verification",
  }),
  "subscription is inactive",
);

await expectRejected(
  "expired storefront appointment",
  anonymous.rpc("create_public_appointment", {
    p_tenant_id: expiredTenantId,
    p_service_id: process.env.ENTITLEMENT_TEST_EXPIRED_SERVICE_ID,
    p_appointment_date: process.env.ENTITLEMENT_TEST_APPOINTMENT_DATE,
    p_appointment_time: process.env.ENTITLEMENT_TEST_APPOINTMENT_TIME,
    p_customer_name: "Expired Trial Verification",
    p_customer_email: "expired-verification@example.invalid",
    p_customer_phone: "+15555550132",
    p_notes: "Entitlement verification",
  }),
  "subscription is inactive",
);

await signIn(
  superAdmin,
  process.env.ENTITLEMENT_TEST_SUPER_ADMIN_EMAIL,
  process.env.ENTITLEMENT_TEST_SUPER_ADMIN_PASSWORD,
);
await expectRejected(
  "SUPER_ADMIN subscription authorization",
  superAdmin.rpc("set_tenant_subscription", {
    p_tenant_id: expiredTenantId,
    p_plan: "__verification_invalid__",
    p_subscription_status: "active",
    p_trial_days: null,
  }),
  "valid subscription plan",
);

console.log(
  "Entitlement verification passed for plan limits, expired access, public activity blocking, and SUPER_ADMIN authorization.",
);
