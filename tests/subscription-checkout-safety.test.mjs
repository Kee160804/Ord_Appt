import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("subscription checkout redirects to the bank-hosted payment page", async () => {
  const [settings, required, preview] = await Promise.all([
    read("app/components/SettingsView.tsx"),
    read("app/components/SubscriptionRequired.tsx"),
    read("app/components/SubscriptionCheckoutPreview.tsx"),
  ]);

  assert.match(settings, /SubscriptionCheckoutPreview/);
  assert.match(required, /SubscriptionCheckoutPreview/);
  assert.match(preview, /startSubscriptionCheckout/);
  assert.match(preview, /crypto\.randomUUID\(\)/);
  assert.match(preview, /window\.location\.assign\(result\.redirectUrl\)/);
  assert.match(
    preview,
    /router\.push\("\/dashboard\/settings\?tab=payments"\)/,
  );
  assert.match(preview, /DigiWallet/);
  assert.match(preview, /Feature Coming Soon/);
  assert.match(preview, /Credit \/ Debit Card/);
  assert.match(preview, /Continue to Belize Bank/);
  assert.match(preview, /onClick=\{\(\) => void continueToBank\(\)\}/);
  assert.doesNotMatch(preview, /CardPaymentStep/);
  assert.doesNotMatch(preview, /Secure Card/);
  assert.doesNotMatch(preview, /<input/);
  assert.doesNotMatch(preview, /autoComplete="cc-/);
  assert.match(preview, /title="Secure subscription checkout"/);
  assert.match(preview, /maxWidth="max-w-2xl"/);
  assert.match(preview, /LockKeyhole[\s\S]+Continue/);
  assert.match(settings, /LockKeyhole[\s\S]+Checkout/);
  assert.match(settings, /getBelizeBankCheckoutStatus/);
  assert.match(required, /getBelizeBankCheckoutStatus/);
});

test("server checkout fails closed until the real gateway is enabled", async () => {
  const [route, provider] = await Promise.all([
    read("app/api/billing/checkout/route.ts"),
    read("app/lib/billing/provider.ts"),
  ]);

  assert.match(route, /SUBSCRIPTION_CHECKOUT_ENABLED !== "true"/);
  assert.match(route, /No payment was taken/);
  assert.match(provider, /ENABLE_MOCK_BILLING === "true"/);
  assert.match(provider, /Mock subscription activation is disabled/);
});

test("billing summary repairs unverified activation back to the trial", async () => {
  const [route, migration] = await Promise.all([
    read("app/api/billing/subscription/route.ts"),
    read(
      "supabase/migrations/202610190001_disable_unverified_subscription_checkout.sql",
    ),
  ]);

  for (const source of [route, migration]) {
    assert.match(source, /BELIZE_BANK/);
    assert.match(source, /PARTIALLY_REFUNDED/);
    assert.match(source, /subscription_status/);
    assert.match(source, /trial/);
    assert.match(source, /subscription_recurring_total/);
  }
  assert.match(route, /paidLookingStatus/);
  assert.match(route, /subscription_paid_staff_seats: 0/);
  assert.match(migration, /DELETE FROM public\.business_notifications/);
  assert.match(migration, /No verified Belize Bank payment was collected/);
});
