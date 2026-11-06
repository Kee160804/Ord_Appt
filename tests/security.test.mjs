import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  agents: "app/api/admin/agents/route.ts",
  tenants: "app/api/admin/tenants/route.ts",
  publicSecurity: "app/lib/server/security.ts",
  orderApi: "app/api/public/orders/route.ts",
  bookingApi: "app/api/public/bookings/route.ts",
  promotionApi: "app/api/public/promotions/route.ts",
  contactApi: "app/api/public/contact/route.ts",
  privacyApi: "app/api/privacy/requests/route.ts",
  receiptApi: "app/api/public/payment-receipts/route.ts",
  callbackApi: "app/api/billing/belize-bank/callback/route.ts",
};

test("admin provisioning uses cryptographic randomness and does not return credentials", async () => {
  const source = (
    await Promise.all([
      readFile(files.agents, "utf8"),
      readFile(files.tenants, "utf8"),
    ])
  ).join("\n");
  assert.doesNotMatch(source, /Math\.random/);
  assert.doesNotMatch(source, /temporaryPassword\s*:/);
  assert.doesNotMatch(source, /recoveryUrl\s*[,}]/);
  assert.match(source, /generateSecurePassword/);
  assert.doesNotMatch(source, /updateUserById\([^)]*password/);
});

test("every mutating public route applies origin, body, and rate-limit checks", async () => {
  for (const path of [
    files.orderApi,
    files.bookingApi,
    files.promotionApi,
    files.contactApi,
    files.privacyApi,
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /requestHasAllowedOrigin/);
    assert.match(source, /readJsonBody/);
    assert.match(source, /enforce(?:Public|Platform)RateLimit/);
    assert.match(source, /rateLimitResponse/);
    assert.match(source, /getSupabaseAdminClient/);
    assert.doesNotMatch(source, /getSupabasePublicClient/);
  }
});

test("database mutation RPCs cannot bypass the protected routes", async () => {
  const source = await readFile(
    "supabase/migrations/202609070001_mock_payments_and_public_protection.sql",
    "utf8",
  );
  for (const name of [
    "create_public_order_v3",
    "create_public_appointment_with_payment",
    "calculate_promotion_discount",
    "submit_storefront_contact_message",
  ]) {
    assert.match(
      source,
      new RegExp(
        `REVOKE ALL ON FUNCTION public\\.${name}[^;]+FROM PUBLIC,anon,authenticated`,
      ),
    );
  }
});

test("rate limiter hashes request identity before persistence", async () => {
  const source = await readFile(files.publicSecurity, "utf8");
  assert.match(source, /createHash\("sha256"\)/);
  assert.match(source, /check_public_rate_limit/);
});

test("every JSON mutation route uses the bounded shared body reader", async () => {
  for (const path of [
    "app/api/admin/agents/route.ts",
    "app/api/admin/tenants/route.ts",
    "app/api/admin/tenants/[tenantId]/domain/route.ts",
    "app/api/admin/tenants/[tenantId]/subscription/route.ts",
    "app/api/appointments/status/route.ts",
    "app/api/email/team-invitation/route.ts",
    "app/api/orders/status/route.ts",
    "app/api/payments/appointments/manual/route.ts",
    "app/api/payments/submissions/route.ts",
    "app/api/public/appointment-booking/route.ts",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /requestHasAllowedOrigin/, path);
    assert.match(source, /readJsonBody/, path);
    assert.doesNotMatch(source, /request\.json\(\)/, path);
  }
});

test("receipt uploads are bounded before multipart parsing", async () => {
  const source = await readFile(files.receiptApi, "utf8");
  assert.match(source, /readFormDataBody/);
  assert.doesNotMatch(source, /request\.formData\(\)/);
  assert.match(source, /REQUEST_TOO_LARGE/);
});

test("bank callbacks are throttled before checkout lookup", async () => {
  const source = await readFile(files.callbackApi, "utf8");
  const throttle = source.indexOf("enforcePlatformRateLimit(");
  const lookup = source.indexOf("findBelizeBankCheckoutForCallback(");
  assert.ok(throttle >= 0);
  assert.ok(lookup > throttle);
});

test("public database errors require an approved business SQLSTATE", async () => {
  const source = await readFile(files.publicSecurity, "utf8");
  assert.match(source, /publicBusinessCodes/);
  assert.match(source, /\["22023", "23505", "P0001"\]/);
  assert.match(source, /raw\.length > 240/);
});

test("production responses enable HSTS", async () => {
  const source = await readFile("next.config.ts", "utf8");
  assert.match(source, /Strict-Transport-Security/);
  assert.match(source, /max-age=31536000; includeSubDomains/);
  assert.match(source, /!isDevelopment/);
});

test("anonymous users cannot enumerate database tables or call SQL directly", async () => {
  const migration = await readFile(
    "supabase/migrations/202611050001_close_anonymous_database_access.sql",
    "utf8",
  );
  const storefront = await readFile(
    "app/services/storefrontService.ts",
    "utf8",
  );
  const availability = await readFile(
    "app/services/appointmentService.ts",
    "utf8",
  );

  assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /REVOKE ALL PRIVILEGES ON TABLE[^;]+FROM anon/);
  assert.match(migration, /REVOKE EXECUTE ON ALL FUNCTIONS[^;]+PUBLIC, anon/);
  assert.match(
    migration,
    /get_public_appointment_availability[\s\S]+FROM authenticated/,
  );
  assert.match(migration, /pg_catalog\.pg_policies/);
  assert.match(storefront, /getSupabaseAdminClient/);
  assert.doesNotMatch(storefront, /getSupabasePublicClient/);
  assert.doesNotMatch(storefront, /\.from\("tenants"\)\s*\.select\("\*"\)/);
  assert.doesNotMatch(storefront, /provider_customer_id/);
  assert.match(availability, /\/api\/public\/availability/);
  assert.doesNotMatch(
    availability,
    /client\(\)\.rpc\([\s\S]*get_public_(?:provider|appointment)_availability/,
  );
});

test("public availability is server-side and rate limited", async () => {
  const source = await readFile("app/api/public/availability/route.ts", "utf8");
  assert.match(source, /getSupabaseAdminClient/);
  assert.match(source, /enforcePublicRateLimit/);
  assert.match(source, /isValidUuid/);
  assert.match(source, /Cache-Control/);
});
