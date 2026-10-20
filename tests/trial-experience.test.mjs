import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("business switching identifies trials instead of advertising a paid plan", async () => {
  const source = await readFile("app/components/BusinessSwitcher.tsx", "utf8");

  assert.match(source, /getTenantEntitlement/);
  assert.match(source, /Free Trial/);
  assert.match(source, /daysRemaining/);
  assert.match(source, /Free Trial expired/);
});

test("billing history includes only verified Belize Bank subscription payments", async () => {
  const source = await readFile("app/services/billingService.ts", "utf8");

  assert.match(source, /\.eq\("provider", "BELIZE_BANK"\)/);
  assert.match(source, /\.not\("paid_at", "is", null\)/);
  assert.match(source, /verifiedInvoiceIds/);
  assert.match(source, /row\.status === "PAID"/);
});

test("prelaunch paid-looking records return to their original trial timeline", async () => {
  const sql = await readFile(
    "supabase/migrations/202610160005_prelaunch_trial_normalization.sql",
    "utf8",
  );

  assert.match(sql, /status = 'FAILED'/);
  assert.match(sql, /status = 'VOID'/);
  assert.match(sql, /subscription_status = 'trial'/);
  assert.match(sql, /tenant\.created_at \+ INTERVAL '14 days'/);
  assert.match(sql, /subscription_recurring_total = 0/);
  assert.match(sql, /subscription_paid_staff_seats = 0/);
});
