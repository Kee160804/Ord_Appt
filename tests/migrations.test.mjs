import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

test("repository includes a standalone schema before additive migrations", async () => {
  const names = (await readdir("supabase/migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  assert.equal(names[0], "202608230001_baseline_schema.sql");
  const baseline = await readFile(`supabase/migrations/${names[0]}`, "utf8");
  for (const table of [
    "tenants",
    "profiles",
    "tenant_memberships",
    "products",
    "services",
    "orders",
    "appointments",
  ]) {
    assert.match(
      baseline,
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`),
    );
  }
  for (const name of names) {
    const sql = await readFile(`supabase/migrations/${name}`, "utf8");
    assert.match(sql, /\bBEGIN\s*;/i, `${name} should open a transaction`);
    assert.match(sql, /\bCOMMIT\s*;/i, `${name} should commit a transaction`);
  }
});

test("mock payment migration is explicit, atomic, and provider neutral", async () => {
  const sql = await readFile(
    "supabase/migrations/202609070001_mock_payments_and_public_protection.sql",
    "utf8",
  );
  assert.match(sql, /payment_transactions/);
  assert.match(sql, /subscription_invoices/);
  assert.match(sql, /create_public_order_v3/);
  assert.match(sql, /create_public_appointment_with_payment/);
  assert.match(sql, /complete_mock_subscription_checkout/);
  assert.match(sql, /provider TEXT NOT NULL DEFAULT 'MOCK'/);
  assert.match(sql, /no real money processed/i);
  assert.match(
    sql,
    /CREATE CONSTRAINT TRIGGER trg_enqueue_order_received_after_insert/,
  );
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/);
});
