import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("platform admin analytics use subscription income instead of tenant commerce", async () => {
  const [service, adminPage, tenantPage, billingService] = await Promise.all([
    readFile("app/services/adminService.ts", "utf8"),
    readFile("app/admin/page.tsx", "utf8"),
    readFile("app/admin/tenant/[Id]/page.tsx", "utf8"),
    readFile("app/services/billingService.ts", "utf8"),
  ]);

  assert.match(service, /\.from\("payment_transactions"\)/);
  assert.match(service, /\.eq\("kind", "SUBSCRIPTION"\)/);
  assert.match(service, /subscriptionRevenue/);
  assert.match(service, /monthlyRecurringRevenue/);
  assert.doesNotMatch(service, /\.from\("orders"\)/);
  assert.doesNotMatch(service, /\.from\("appointments"\)/);
  assert.doesNotMatch(service, /\.from\("customers"\)/);

  assert.match(adminPage, /Subscription Revenue/);
  assert.match(adminPage, /Monthly Recurring Revenue/);
  assert.match(adminPage, /Subscription Mix/);
  assert.match(adminPage, /Subscription Fee/);
  assert.doesNotMatch(adminPage, /Top Performing Tenants/);
  assert.doesNotMatch(adminPage, /Monthly Revenue/);

  assert.match(tenantPage, /Monthly Subscription/);
  assert.doesNotMatch(tenantPage, /Recognized Revenue/);
  assert.doesNotMatch(tenantPage, /Top Items/);
  assert.match(billingService, /\.eq\("kind", "SUBSCRIPTION"\)/);
});
