import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("subscription checkout UI is a non-mutating coming-soon preview", async () => {
  const [settings, required, preview] = await Promise.all([
    read("app/components/SettingsView.tsx"),
    read("app/components/SubscriptionRequired.tsx"),
    read("app/components/SubscriptionCheckoutPreview.tsx"),
  ]);

  assert.match(settings, /SubscriptionCheckoutPreview/);
  assert.match(required, /SubscriptionCheckoutPreview/);
  assert.doesNotMatch(settings, /startSubscriptionCheckout/);
  assert.doesNotMatch(required, /startSubscriptionCheckout/);
  assert.doesNotMatch(preview, /fetch\(/);
  assert.match(preview, /Checkout ID: #/);
  assert.match(preview, /DigiWallet/);
  assert.match(preview, /Credit \/ Debit Card/);
  assert.match(preview, /Card Number/);
  assert.match(preview, /Name on Card/);
  assert.match(preview, /label="CVV"/);
  assert.match(preview, /American Express/);
  assert.match(preview, /Mastercard/);
  assert.match(preview, /Discover/);
  assert.match(preview, /PaymentBrandLogo/);
  assert.match(preview, /CARD_BRAND_LABELS\[cardBrand\(cardNumber\)\]/);
  assert.match(preview, /from-violet-700/);
  assert.match(preview, /aspect-\[1\.586\/1\]/);
  assert.match(preview, /title="Checkout"/);
  assert.match(preview, /maxWidth="max-w-2xl"/);
  assert.doesNotMatch(preview, /const steps =/);
  assert.match(preview, /<CardPreview[\s\S]+Payment Method/);
  assert.match(preview, /LockKeyhole[\s\S]+Continue/);
  assert.match(preview, /DigiWallet payments are coming soon/);
  assert.match(preview, /value\.toUpperCase\(\)/);
  assert.match(preview, /onSecurityCodeFocus\(true\)/);
  assert.match(preview, /rotateY\(180deg\)/);
  assert.match(settings, /LockKeyhole[\s\S]+Checkout/);
  assert.match(preview, /coming soon and is not available yet/);
  assert.match(preview, /subscription was not changed/);
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
