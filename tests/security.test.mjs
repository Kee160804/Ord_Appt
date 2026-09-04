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
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(source, /requestHasAllowedOrigin/);
    assert.match(source, /readJsonBody/);
    assert.match(source, /enforcePublicRateLimit/);
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
