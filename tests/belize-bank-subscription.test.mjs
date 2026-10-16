import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("Belize Bank subscription checkout uses the hosted form protocol", async () => {
  const gateway = await read("app/lib/billing/belize-bank.ts");
  assert.match(gateway, /application\/x-www-form-urlencoded/);
  assert.match(gateway, /\/register\.do/);
  assert.match(gateway, /\/getOrderStatusExtended\.do/);
  assert.match(gateway, /dynamicCallbackUrl/);
  assert.match(gateway, /returnURL/);
  assert.match(gateway, /amount: String\(minorAmount\(input\.amount\)\)/);
  assert.doesNotMatch(gateway, /cardNumber|\bcvv\b|\bcvc\b/i);
});

test("only verified exact-amount authorizations activate subscriptions", async () => {
  const reconciliation = await read("app/lib/billing/belize-bank-checkout.ts");
  assert.match(reconciliation, /gateway\.orderStatus === 2/);
  assert.match(reconciliation, /gateway\.amountMinor !== expectedMinor/);
  assert.match(reconciliation, /complete_subscription_checkout_v2/);
  assert.match(reconciliation, /p_provider: "BELIZE_BANK"/);
  assert.match(reconciliation, /idempotencyKey/);
});

test("callbacks are notifications and re-query Belize Bank before writes", async () => {
  const callback = await read("app/api/billing/belize-bank/callback/route.ts");
  const reconciliation = await read("app/lib/billing/belize-bank-checkout.ts");
  assert.match(callback, /URLSearchParams/);
  assert.match(callback, /enforcePublicRateLimit/);
  assert.match(callback, /reconcileBelizeBankSubscriptionCheckout/);
  assert.match(reconciliation, /getBelizeBankOrderStatus/);
});

test("Belize Bank is limited to platform subscription billing", async () => {
  const [provider, checkout, orderRoute, bookingRoute] = await Promise.all([
    read("app/lib/billing/provider.ts"),
    read("app/api/billing/checkout/route.ts"),
    read("app/api/public/orders/route.ts"),
    read("app/api/public/bookings/route.ts"),
  ]);
  assert.match(provider, /id: "BELIZE_BANK"/);
  assert.match(checkout, /provider\.id === "BELIZE_BANK"/);
  assert.doesNotMatch(orderRoute, /BELIZE_BANK/);
  assert.doesNotMatch(bookingRoute, /BELIZE_BANK/);
});

test("checkout sessions remain pending until verified completion", async () => {
  const migration = await read(
    "supabase/migrations/202610150003_belize_bank_subscription_checkout.sql",
  );
  assert.match(migration, /subscription_checkout_sessions/);
  assert.match(migration, /'REGISTERING', 'PENDING', 'SUCCEEDED'/);
  assert.match(migration, /REVOKE ALL[\s\S]+authenticated/);
  assert.doesNotMatch(migration, /subscription_status\s*=\s*'active'/);
});
