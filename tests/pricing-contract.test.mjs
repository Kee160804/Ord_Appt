import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PLAN_CATALOG,
  PREMIUM_FEATURES,
  TRIAL_ENTITLEMENTS,
  approximateDailyPrice,
  calculateSubscriptionAmounts,
  evaluateSubscriptionAccess,
  validateSubscriptionSeatSelection,
} from "../app/lib/plan-catalog.mjs";

const migrationPath =
  "supabase/migrations/202609210001_subscription_entitlements_and_billing.sql";

test("canonical plans match every advertised price, activity, and account limit", () => {
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(PLAN_CATALOG).map(([id, plan]) => [
        id,
        {
          price: plan.price,
          activity: plan.monthlyActivityLimit,
          accounts: plan.maxStaffSeats + 1,
          includedStaff: plan.includedStaffSeats,
          seatPrice: plan.additionalStaffSeatPrice,
        },
      ]),
    ),
    {
      starter: {
        price: 9,
        activity: 50,
        accounts: 1,
        includedStaff: 0,
        seatPrice: 2,
      },
      pro: {
        price: 12,
        activity: 150,
        accounts: 5,
        includedStaff: 1,
        seatPrice: 2,
      },
      enterprise: {
        price: 15,
        activity: null,
        accounts: 10,
        includedStaff: 2,
        seatPrice: 2,
      },
    },
  );
  assert.equal(approximateDailyPrice(15), 0.5);
});

test("database plan and trial catalogs mirror the server-safe application catalog", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /\('starter', 'Beginner', 9, 50, 0, 0, 2\)/);
  assert.match(sql, /\('pro', 'Pro', 12, 150, 1, 4, 2\)/);
  assert.match(sql, /\('enterprise', 'Enterprise', 15, NULL, 2, 9, 2\)/);
  assert.match(sql, /VALUES \(TRUE, 14, 150, 1, 1\)/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.subscription_invoices/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.payment_transactions/);
});

test("the 14-day trial has explicit activity/staff overrides and all premium features", () => {
  assert.deepEqual(TRIAL_ENTITLEMENTS, {
    lengthDays: 14,
    monthlyActivityLimit: 150,
    includedStaffSeats: 1,
    maxStaffSeats: 1,
  });
  assert.deepEqual([...PREMIUM_FEATURES].sort(), [
    "advanced_catalog",
    "booking_deposits",
    "detailed_analytics",
    "product_variants",
    "storefront_branding",
    "storefront_contact_form",
    "team_management",
  ]);

  const started = new Date("2026-01-01T00:00:00.000Z");
  const beforeExpiration = evaluateSubscriptionAccess(
    { subscriptionStatus: "trial", createdAt: started },
    new Date("2026-01-14T23:59:59.999Z"),
  );
  assert.equal(beforeExpiration.state, "trial");
  assert.equal(beforeExpiration.hasAccess, true);

  const atExpiration = evaluateSubscriptionAccess(
    { subscriptionStatus: "trial", createdAt: started },
    new Date("2026-01-15T00:00:00.000Z"),
  );
  assert.equal(atExpiration.state, "expired");
  assert.equal(atExpiration.hasAccess, false);
});

test("paid access requires a current period and cancellation preserves only that period", () => {
  const now = new Date("2026-02-10T12:00:00.000Z");
  const future = "2026-03-01T00:00:00.000Z";
  const past = "2026-02-01T00:00:00.000Z";

  assert.equal(
    evaluateSubscriptionAccess(
      { subscriptionStatus: "active", currentPeriodEnd: future },
      now,
    ).hasAccess,
    true,
  );
  assert.equal(
    evaluateSubscriptionAccess({ subscriptionStatus: "active" }, now).hasAccess,
    false,
  );
  assert.equal(
    evaluateSubscriptionAccess(
      { subscriptionStatus: "active", currentPeriodEnd: past },
      now,
    ).hasAccess,
    false,
  );
  const canceled = evaluateSubscriptionAccess(
    {
      subscriptionStatus: "cancelled",
      currentPeriodEnd: future,
      cancelAtPeriodEnd: true,
    },
    now,
  );
  assert.equal(canceled.hasAccess, true);
  assert.equal(canceled.cancelAtPeriodEnd, true);
  assert.equal(
    evaluateSubscriptionAccess(
      { subscriptionStatus: "cancelled", currentPeriodEnd: past },
      now,
    ).hasAccess,
    false,
  );
  assert.equal(
    evaluateSubscriptionAccess(
      { subscriptionStatus: "past_due", currentPeriodEnd: future },
      now,
    ).hasAccess,
    false,
  );
});

test("server-safe seat calculations enforce recurring totals and plan maximums", () => {
  assert.deepEqual(calculateSubscriptionAmounts("pro", 3), {
    planId: "pro",
    baseAmount: 12,
    paidStaffSeats: 3,
    seatAmount: 6,
    recurringTotal: 18,
    maximumPaidSeats: 3,
    currency: "BZD",
    billingPeriod: "month",
  });
  assert.equal(
    calculateSubscriptionAmounts("enterprise", 7).recurringTotal,
    29,
  );
  assert.throws(() => calculateSubscriptionAmounts("starter", 1), /at most 0/);
  assert.throws(() => calculateSubscriptionAmounts("pro", 4), /at most 3/);
  assert.throws(() => calculateSubscriptionAmounts("pro", -1), /non-negative/);
  assert.throws(() => calculateSubscriptionAmounts("pro", 1.5), /whole number/);

  assert.equal(
    validateSubscriptionSeatSelection("pro", 2, 3).authorizedStaff,
    3,
  );
  assert.throws(
    () => validateSubscriptionSeatSelection("pro", 1, 3),
    /Remove active staff or purchase enough seats/,
  );
});

test("checkout and cancellation are owner-only, tenant-scoped, and server-priced", async () => {
  const [authorization, checkout, cancellation] = await Promise.all([
    readFile("app/lib/server/billing-authorization.ts", "utf8"),
    readFile("app/api/billing/checkout/route.ts", "utf8"),
    readFile("app/api/billing/subscription/route.ts", "utf8"),
  ]);
  assert.match(authorization, /\.eq\("tenant_id", tenantId\)/);
  assert.match(authorization, /\.eq\("profile_id", authData\.user\.id\)/);
  assert.match(authorization, /role\?\.toUpperCase\(\) !== "OWNER"/);
  assert.match(authorization, /status: 403/);
  assert.match(checkout, /authorizeBillingOwner\(tenantId\)/);
  assert.match(
    checkout,
    /calculateSubscriptionAmounts\(body\.plan, paidStaffSeats\)/,
  );
  assert.doesNotMatch(
    checkout,
    /body\.(?:baseAmount|seatAmount|recurringTotal)/,
  );
  assert.match(cancellation, /authorizeBillingOwner\(tenantId\)/);
  assert.match(cancellation, /cancel_tenant_subscription_at_period_end/);
});

test("database enforcement covers periods, premium writes, seat safety, and idempotency", async () => {
  const sql = await readFile(migrationPath, "utf8");
  for (const field of [
    "current_period_start",
    "current_period_end",
    "cancel_at_period_end",
    "canceled_at",
    "provider_customer_id",
    "provider_subscription_id",
    "subscription_paid_staff_seats",
    "subscription_base_amount",
    "subscription_seat_amount",
    "subscription_recurring_total",
  ]) {
    assert.match(sql, new RegExp(field));
  }
  assert.match(sql, /current_period_end > NOW\(\) AS has_paid_access/);
  assert.match(sql, /subscription_status = 'expired'/);
  assert.match(sql, /enforce_product_variant_plan/);
  assert.match(
    sql,
    /BEFORE INSERT OR UPDATE OR DELETE ON public\.product_variants/,
  );
  assert.match(
    sql,
    /tenant_plan_has_feature\(v_tenant_id, 'product_variants'\)/,
  );
  for (const field of [
    "cover_image_position_x",
    "cover_image_position_y",
    "cover_image_zoom",
    "primary_color",
    "accent_color",
    "custom_domain",
  ]) {
    assert.match(
      sql,
      new RegExp(`NEW\\.${field} IS DISTINCT FROM OLD\\.${field}`),
    );
  }
  assert.match(
    sql,
    /v_active_staff > v_catalog\.included_staff_seats \+ p_paid_staff_seats/,
  );
  assert.match(sql, /WHERE payment\.idempotency_key = p_idempotency_key/);
  assert.match(sql, /PG_ADVISORY_XACT_LOCK\(HASHTEXT\(p_idempotency_key\)\)/);
  assert.match(sql, /already used for different subscription details/);
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.complete_subscription_checkout_v2[\s\S]+authenticated/,
  );
});

test("mock billing is development-only and stale marketing/payment placeholders are gone", async () => {
  const [provider, home, subscriptionRequired, env] = await Promise.all([
    readFile("app/lib/billing/provider.ts", "utf8"),
    readFile("app/home/page.tsx", "utf8"),
    readFile("app/components/SubscriptionRequired.tsx", "utf8"),
    readFile(".env.example", "utf8"),
  ]);
  assert.match(provider, /NODE_ENV === "production"/);
  assert.match(
    provider,
    /Mock subscription payments are disabled in production/,
  );
  assert.match(provider, /BILLING_PROVIDER=mock is not allowed in production/);
  const publicSources = `${home}\n${subscriptionRequired}\n${env}`;
  assert.doesNotMatch(publicSources, /https:\/\/your-payment-link\//);
  assert.doesNotMatch(publicSources, /5(?:×|Ã—)|\$0\.53\/day/i);
  assert.doesNotMatch(publicSources, /Unlimited products or services/i);
  assert.match(home, /3× the monthly activity/);
});
