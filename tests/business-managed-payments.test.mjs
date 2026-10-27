import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const paymentMigration =
  "supabase/migrations/202610220001_business_managed_payments_fulfillment.sql";
const reservationMigration =
  "supabase/migrations/202610230001_retail_purchase_reservations.sql";
const atomicReviewMigration =
  "supabase/migrations/202610270002_atomic_customer_payment_review.sql";

test("customer payments remain separate from platform subscription billing", async () => {
  const sql = await readFile(paymentMigration, "utf8");
  assert.match(sql, /business_payment_methods/);
  assert.match(sql, /customer_payment_submissions/);
  assert.match(sql, /payment_verification_events/);
  assert.match(sql, /'payment-receipts','payment-receipts',FALSE/);
  assert.doesNotMatch(sql, /INSERT INTO public\.payment_transactions/i);
  assert.doesNotMatch(sql, /UPDATE public\.subscription_invoices/i);
});

test("checkout uses only business-configured customer payment methods", async () => {
  const [ordering, checkout] = await Promise.all([
    readFile("app/components/OrderingMenu.tsx", "utf8"),
    readFile("app/components/CustomerPaymentCheckout.tsx", "utf8"),
  ]);
  assert.match(ordering, /<CustomerPaymentCheckout/);
  assert.match(ordering, /onPlaceOrder=\{\(\) => void placeOrder\(\)\}/);
  assert.match(ordering, /paymentOptions=\{paymentOptions\}/);
  assert.doesNotMatch(ordering, /mock_card|Credit \/ Debit Card/);
  assert.match(checkout, /Payment is made directly to/);
  assert.match(checkout, /Go to Track Order/);
});

test("bank account numbers are disclosed only after verified tracking", async () => {
  const [optionsRoute, trackingRoute] = await Promise.all([
    readFile("app/api/public/payment-options/route.ts", "utf8"),
    readFile("app/api/public/order-tracking/route.ts", "utf8"),
  ]);
  assert.match(optionsRoute, /bankAccounts: \[\]/);
  assert.doesNotMatch(optionsRoute, /\.from\("business_bank_accounts"\)/);
  assert.match(trackingRoute, /getVerifiedTrackingSession/);
  assert.match(trackingRoute, /\.from\("business_bank_accounts"\)/);
  assert.match(trackingRoute, /createSignedUrl\(receipt\.receipt_path, 300\)/);
});

test("tracking receipt uploads require a verified expiring session", async () => {
  const [route, trackingSql] = await Promise.all([
    readFile("app/api/public/payment-receipts/route.ts", "utf8"),
    readFile(
      "supabase/migrations/202610250001_customer_order_tracking.sql",
      "utf8",
    ),
  ]);
  assert.match(route, /getVerifiedTrackingSession/);
  assert.match(route, /submit_tracked_order_receipt/);
  assert.match(route, /AWAITING_VERIFICATION/);
  assert.doesNotMatch(route, /payment_status:\s*"PAID"/);
  assert.match(trackingSql, /verified_at IS NOT NULL/);
  assert.match(trackingSql, /expires_at > NOW\(\)/);
  assert.match(
    trackingSql,
    /REVOKE ALL ON FUNCTION public\.submit_tracked_order_receipt/,
  );
});

test("payment review and confirmation email commit atomically", async () => {
  const [route, reviewSql, emailSql] = await Promise.all([
    readFile("app/api/payments/submissions/route.ts", "utf8"),
    readFile(atomicReviewMigration, "utf8"),
    readFile(
      "supabase/migrations/202610270001_customer_checkout_notifications.sql",
      "utf8",
    ),
  ]);
  assert.match(route, /review_customer_payment_submission/);
  assert.doesNotMatch(route, /\.from\("orders"\)\s*\.update/);
  assert.match(reviewSql, /FOR UPDATE/);
  assert.match(reviewSql, /payment_verification_events/);
  assert.match(reviewSql, /payment_status = v_payment_status/);
  assert.match(reviewSql, /FROM PUBLIC, anon, authenticated/);
  assert.match(emailSql, /AFTER UPDATE OF payment_status ON public\.orders/);
  assert.match(emailSql, /'PAYMENT_CONFIRMED'/);
});

test("retail reservations are locked, expiring, and independent of subscriptions", async () => {
  const sql = await readFile(reservationMigration, "utf8");
  assert.match(sql, /expire_retail_purchase_reservations/i);
  assert.match(sql, /FOR UPDATE/i);
  assert.match(sql, /customer_verification_status/i);
  assert.match(sql, /inventory_reservation_status/i);
  assert.doesNotMatch(sql, /subscription_invoices/i);
  assert.doesNotMatch(sql, /payment_transactions/i);
});

test("owners control verification windows and review receipts in the dashboard", async () => {
  const [view, service] = await Promise.all([
    readFile("app/components/PaymentFulfillmentView.tsx", "utf8"),
    readFile("app/services/businessPaymentService.ts", "utf8"),
  ]);
  assert.match(view, /Retail purchase reservations/);
  assert.match(view, /Verify funds received/);
  assert.match(service, /retail_reservations_enabled/);
  assert.match(service, /email_verification_minutes/);
  assert.match(service, /payment_window_minutes/);
});

test("superseded recovery and demo surfaces are removed", async () => {
  for (const path of [
    "app/lib/order-tracking-demo.ts",
    "app/components/OrderRecovery.tsx",
    "app/components/OrderEmailVerification.tsx",
    "app/components/PaymentReceiptUpload.tsx",
    "app/api/public/order-access/route.ts",
    "app/api/public/order-verification/route.ts",
    "app/store-front/[slug]/order/page.tsx",
  ]) {
    await assert.rejects(access(path));
  }
});
