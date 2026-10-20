import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("admin tenant list distinguishes live and expired free trials", async () => {
  const [adminPage, service] = await Promise.all([
    readFile("app/admin/page.tsx", "utf8"),
    readFile("app/services/adminService.ts", "utf8"),
  ]);

  assert.match(adminPage, /Free Trial Expired/);
  assert.match(adminPage, /Free Trial/);
  assert.match(adminPage, /subscriptionRecurringTotal/);
  assert.match(adminPage, /\/ month/);
  assert.match(adminPage, /freeTrialCount/);
  assert.match(service, /provider\.toUpperCase\(\) === "BELIZE_BANK"/);
  assert.match(service, /paidTenantIds/);
});

test("trial extensions use the canonical trial length as their maximum", async () => {
  const [route, tenantPage, migration] = await Promise.all([
    readFile("app/api/admin/tenants/[tenantId]/subscription/route.ts", "utf8"),
    readFile("app/admin/tenant/[Id]/page.tsx", "utf8"),
    readFile(
      "supabase/migrations/202610160002_admin_trial_extensions.sql",
      "utf8",
    ),
  ]);

  assert.match(route, /trialDays > TRIAL_ENTITLEMENTS\.lengthDays/);
  assert.match(route, /existingTrialEnd\.getTime\(\) > Date\.now\(\)/);
  assert.match(route, /extensionStartsAt\.getTime\(\) \+ days/);
  assert.match(
    tenantPage,
    /Extra trial days \(1–\{TRIAL_ENTITLEMENTS\.lengthDays\}\)/,
  );
  assert.match(tenantPage, /max=\{TRIAL_ENTITLEMENTS\.lengthDays\}/);
  assert.match(migration, /p_trial_days > 14/);
  assert.match(
    migration,
    /GREATEST\(COALESCE\(trial_ends_at, NOW\(\)\), NOW\(\)\)/,
  );
});

test("unverified and mock paid access is reset to the original trial deadline", async () => {
  const [route, migration] = await Promise.all([
    readFile("app/api/admin/tenants/[tenantId]/subscription/route.ts", "utf8"),
    readFile(
      "supabase/migrations/202610160003_reset_unverified_paid_access.sql",
      "utf8",
    ),
  ]);

  assert.match(route, /successfully verified Belize Bank subscription payment/);
  assert.match(migration, /tenant\.created_at \+ INTERVAL '14 days'/);
  assert.match(migration, /UPPER\(payment\.provider\) = 'BELIZE_BANK'/);
  assert.match(migration, /subscription_recurring_total = 0/);
  assert.match(migration, /FROM authenticated/);
});

test("new tenants always receive the standard 14-day trial", async () => {
  const route = await readFile("app/api/admin/tenants/route.ts", "utf8");

  assert.match(route, /const trialDays = TRIAL_ENTITLEMENTS\.lengthDays/);
  assert.doesNotMatch(route, /body\.trialDays/);
});
