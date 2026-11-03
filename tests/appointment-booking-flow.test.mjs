import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("appointment storefront uses categories and Track Booking without changing order tracking", async () => {
  const [services, store, tracking] = await Promise.all([
    read("app/components/ServicesView.tsx"),
    read("app/components/store.tsx"),
    read("app/components/StorefrontOrderTracking.tsx"),
  ]);
  assert.match(services, /Manage Categories/);
  assert.match(services, /listDepartments/);
  assert.match(store, /isAppt \? "Track Booking" : "Track Order"/);
  assert.match(tracking, /mode\?: "order" \| "appointment"/);
});

test("appointment payments support deposit review, in-person confirmation, and later balances", async () => {
  const [
    migration,
    choiceMigration,
    checkout,
    dashboard,
    receiptRoute,
    optionsRoute,
  ] = await Promise.all([
    read("supabase/migrations/202610300002_appointment_customer_payments.sql"),
    read(
      "supabase/migrations/202611020001_ordering_checkout_and_appointment_payment_choice.sql",
    ),
    read("app/components/AppointmentBooking.tsx"),
    read("app/components/AppointmentsView.tsx"),
    read("app/api/public/payment-receipts/route.ts"),
    read("app/api/public/payment-options/route.ts"),
  ]);
  assert.match(checkout, /Deposit by bank transfer/);
  assert.match(checkout, /Pay deposit in person/);
  assert.match(checkout, /Choose payment amount/);
  assert.match(checkout, /Pay in full/);
  assert.match(dashboard, /Customer Payment Choice/);
  assert.match(dashboard, /Remaining Balance/);
  assert.doesNotMatch(dashboard, /View receipt/);
  assert.doesNotMatch(dashboard, /Accept deposit receipt/);
  assert.match(migration, /record_appointment_in_person_payment/);
  assert.match(
    migration,
    /ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'UNPAID'/,
  );
  assert.match(migration, /submission\.status = 'AWAITING_VERIFICATION'/);
  assert.match(choiceMigration, /payment_selection/);
  assert.match(choiceMigration, /p_payment_option/);
  assert.match(choiceMigration, /v_appointment\.payment_selection = 'FULL'/);
  assert.match(receiptRoute, /targetType === "appointment"/);
  assert.match(optionsRoute, /activeBankAccount/);
  assert.match(optionsRoute, /configuredMethods\.length === 0/);
});

test("verified booking access can reschedule or cancel and receives its booking reference", async () => {
  const [migration, route, tracking, email] = await Promise.all([
    read("supabase/migrations/202610300002_appointment_customer_payments.sql"),
    read("app/api/public/appointment-booking/route.ts"),
    read("app/components/OrderTrackingCenter.tsx"),
    read("app/lib/email/templates.ts"),
  ]);
  assert.match(migration, /update_tracked_appointment/);
  assert.match(migration, /session\.verified_at IS NOT NULL/);
  assert.match(route, /hashGuestAccessToken/);
  assert.match(route, /getVerifiedTrackingSession/);
  assert.match(route, /get_public_appointment_availability/);
  assert.match(route, /get_public_provider_availability/);
  assert.match(tracking, /Cancel Booking/);
  assert.match(tracking, /Reschedule Appointment/);
  assert.match(tracking, /Available times/);
  assert.match(tracking, /Deposit received/);
  assert.match(tracking, /Balance Due/);
  assert.match(email, /APPOINTMENT_RECEIVED/);
  assert.match(email, /Keep this booking reference/);
});

test("appointment emails are limited to received, verification, confirmation, and cancellation", async () => {
  const [
    bookingRoute,
    statusRoute,
    paymentReviewRoute,
    manualPaymentRoute,
    emailWorker,
    emailPolicy,
    dashboard,
    paymentFulfillment,
  ] = await Promise.all([
    read("app/api/public/bookings/route.ts"),
    read("app/api/appointments/status/route.ts"),
    read("app/api/payments/submissions/route.ts"),
    read("app/api/payments/appointments/manual/route.ts"),
    read("app/lib/email/worker.ts"),
    read("supabase/migrations/202611030001_customer_email_policy.sql"),
    read("app/components/AppointmentsView.tsx"),
    read("app/components/PaymentFulfillmentView.tsx"),
  ]);

  assert.match(bookingRoute, /processEmailQueueBestEffort/);
  assert.match(statusRoute, /requireTenantRole/);
  assert.match(statusRoute, /processEmailQueueBestEffort/);
  assert.match(
    statusRoute,
    /status === "CONFIRMED" \|\| status === "CANCELLED"/,
  );
  assert.match(statusRoute, /full payment before confirming the appointment/);
  assert.doesNotMatch(manualPaymentRoute, /processEmailQueueBestEffort/);
  assert.match(paymentReviewRoute, /business_type/);
  assert.match(paymentReviewRoute, /=== "retail"/);
  assert.match(
    emailPolicy,
    /DROP TRIGGER IF EXISTS trg_enqueue_appointment_payment_confirmed_email/,
  );
  assert.match(
    emailPolicy,
    /DROP TRIGGER IF EXISTS trg_schedule_appointment_reminders/,
  );
  assert.match(emailWorker, /APPOINTMENT_PAYMENT_CONFIRMED/);
  assert.match(emailWorker, /appointment email is no longer eligible/);
  assert.match(dashboard, /Confirm & email customer/);
  assert.match(paymentFulfillment, /No customer email was sent/);
});
