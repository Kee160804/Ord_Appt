import { createClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile?.(".env.local");
} catch {
  // CI normally injects environment variables and may not have .env.local.
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "RLS_TEST_A_EMAIL",
  "RLS_TEST_A_PASSWORD",
  "RLS_TEST_B_EMAIL",
  "RLS_TEST_B_PASSWORD",
  "RLS_TEST_INACTIVE_TENANT_ID",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(
    `Missing RLS test environment variables: ${missing.join(", ")}`,
  );
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const businessA = createClient(url, key, options);
const businessB = createClient(url, key, options);
const anonymous = createClient(url, key, options);

async function signIn(client, email, password) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const { data, error: membershipError } = await client
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("is_active", true)
    .limit(1)
    .single();
  if (membershipError) throw membershipError;
  return data.tenant_id;
}

async function fixture(client, table, tenantId, columns = "*") {
  const { data, error } = await client
    .from(table)
    .select(columns)
    .eq("tenant_id", tenantId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Business B needs at least one ${table} fixture.`);
  return data;
}

async function expectHidden(client, table, id) {
  const { data, error } = await client.from(table).select("id").eq("id", id);
  if (error) throw error;
  if (data.length !== 0)
    throw new Error(`RLS failure: Business A can read Business B ${table}.`);
}

async function expectRpcRejected(label, promise) {
  const { error } = await promise;
  if (!error) throw new Error(`RLS failure: ${label} unexpectedly succeeded.`);
}

const tenantA = await signIn(
  businessA,
  process.env.RLS_TEST_A_EMAIL,
  process.env.RLS_TEST_A_PASSWORD,
);
const tenantB = await signIn(
  businessB,
  process.env.RLS_TEST_B_EMAIL,
  process.env.RLS_TEST_B_PASSWORD,
);
if (tenantA === tenantB)
  throw new Error("RLS test accounts must belong to different tenants.");

const [productB, orderB, customerB, appointmentB, serviceB] = await Promise.all(
  [
    fixture(businessB, "products", tenantB, "id,stock,available"),
    fixture(businessB, "orders", tenantB, "id,status"),
    fixture(businessB, "customers", tenantB, "id"),
    fixture(businessB, "appointments", tenantB, "id"),
    fixture(businessB, "services", tenantB, "id"),
  ],
);

await Promise.all([
  expectHidden(businessA, "products", productB.id),
  expectHidden(businessA, "orders", orderB.id),
  expectHidden(businessA, "customers", customerB.id),
  expectHidden(businessA, "appointments", appointmentB.id),
]);

const tenantScopedTables = [
  "business_settings",
  "business_modules",
  "business_hours",
  "categories",
  "products",
  "services",
  "staff",
  "staff_services",
  "customers",
  "orders",
  "order_items",
  "appointments",
  "appointment_services",
  "appointment_email_deliveries",
  "business_notifications",
  "business_reviews",
];
for (const table of tenantScopedTables) {
  const { data, error } = await businessA
    .from(table)
    .select("tenant_id")
    .eq("tenant_id", tenantB)
    .limit(1);
  if (error) throw new Error(`Unable to verify ${table} RLS: ${error.message}`);
  if (data.length !== 0) {
    throw new Error(`RLS failure: Business A can read Business B ${table}.`);
  }
}

const { data: updatedOrders, error: updateError } = await businessA
  .from("orders")
  .update({ status: orderB.status })
  .eq("id", orderB.id)
  .select("id");
if (updateError) throw updateError;
if (updatedOrders.length !== 0) {
  throw new Error("RLS failure: Business A can update Business B orders.");
}

const inactiveTenantId = process.env.RLS_TEST_INACTIVE_TENANT_ID;
const { data: inactiveTenant, error: inactiveReadError } = await anonymous
  .from("tenants")
  .select("id")
  .eq("id", inactiveTenantId);
if (inactiveReadError) throw inactiveReadError;
if (inactiveTenant.length !== 0)
  throw new Error("RLS failure: anon can read an inactive tenant.");

const [publicTenants, publicProducts, publicServices] = await Promise.all([
  anonymous.from("tenants").select("id,is_active,status"),
  anonymous.from("products").select("id,available"),
  anonymous.from("services").select("id,available"),
]);
for (const result of [publicTenants, publicProducts, publicServices]) {
  if (result.error) throw result.error;
}
if (
  publicTenants.data.some(
    (tenant) => !tenant.is_active || tenant.status !== "ACTIVE",
  )
) {
  throw new Error("RLS failure: anon can read inactive storefront tenants.");
}
if (publicProducts.data.some((product) => !product.available)) {
  throw new Error("RLS failure: anon can read unavailable products.");
}
if (publicServices.data.some((service) => !service.available)) {
  throw new Error("RLS failure: anon can read unavailable services.");
}

const futureDate = new Date(Date.now() + 366 * 86_400_000)
  .toISOString()
  .slice(0, 10);
const bookingInput = {
  p_appointment_date: futureDate,
  p_appointment_time: "12:00",
  p_customer_name: "RLS Verification",
  p_customer_email: "rls-verification@example.invalid",
  p_customer_phone: "+15555550123",
  p_notes: null,
};
await expectRpcRejected(
  "public booking accepted another tenant's service",
  anonymous.rpc("create_public_appointment", {
    ...bookingInput,
    p_tenant_id: tenantA,
    p_service_id: serviceB.id,
  }),
);

const [
  { data: tenantARecord, error: tenantAError },
  { data: tenantBRecord, error: tenantBError },
] = await Promise.all([
  businessA.from("tenants").select("business_type").eq("id", tenantA).single(),
  businessB.from("tenants").select("business_type").eq("id", tenantB).single(),
]);
if (tenantAError) throw tenantAError;
if (tenantBError) throw tenantBError;

if (tenantARecord.business_type?.toLowerCase() === "ordering") {
  await expectRpcRejected(
    "public ordering accepted another tenant's product",
    anonymous.rpc("create_public_order", {
      p_tenant_id: tenantA,
      p_customer_name: "RLS Verification",
      p_customer_phone: "+15555550123",
      p_order_type: "pickup",
      p_items: [{ product_id: productB.id, quantity: 1, addons: [] }],
      p_notes: "Cross-tenant verification",
    }),
  );
}

if (
  tenantBRecord.business_type?.toLowerCase() === "ordering" &&
  productB.available &&
  (productB.stock == null || productB.stock > 0)
) {
  const invalidProductId = crypto.randomUUID();
  await expectRpcRejected(
    "failed public order did not roll back",
    anonymous.rpc("create_public_order", {
      p_tenant_id: tenantB,
      p_customer_name: "Rollback Verification",
      p_customer_phone: "+15555550124",
      p_order_type: "pickup",
      p_items: [
        { product_id: productB.id, quantity: 1, addons: [] },
        { product_id: invalidProductId, quantity: 1, addons: [] },
      ],
      p_notes: "Inventory rollback verification",
    }),
  );

  const { data: productAfter, error: productAfterError } = await businessB
    .from("products")
    .select("stock")
    .eq("id", productB.id)
    .single();
  if (productAfterError) throw productAfterError;
  if (productAfter.stock !== productB.stock) {
    throw new Error(
      "Transaction failure: inventory changed after a rejected public order.",
    );
  }
}
await expectRpcRejected(
  "public booking accepted an inactive tenant",
  anonymous.rpc("create_public_appointment", {
    ...bookingInput,
    p_tenant_id: inactiveTenantId,
    p_service_id: serviceB.id,
  }),
);

console.log(
  "RLS verification passed for tenant tables, public RPC isolation, and order rollback safety.",
);
