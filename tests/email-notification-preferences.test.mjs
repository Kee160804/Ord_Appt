import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("owner email alerts are de-duplicated and preference controlled", async () => {
  const [migration, settingsService, settingsView, templates] =
    await Promise.all([
      readFile(
        "supabase/migrations/202610150001_owner_email_preferences.sql",
        "utf8",
      ),
      readFile("app/services/settingsService.ts", "utf8"),
      readFile("app/components/SettingsView.tsx", "utf8"),
      readFile("app/lib/email/templates.ts", "utf8"),
    ]);

  for (const preference of [
    "owner_email_appointments",
    "owner_email_orders",
    "owner_email_retail_orders",
    "owner_email_contact_messages",
    "owner_email_other_alerts",
  ]) {
    assert.match(migration, new RegExp(preference));
    assert.match(settingsService, new RegExp(preference));
  }

  assert.match(
    migration,
    /NEW\.recipient_id IS DISTINCT FROM v_owner_id/,
    "only the selected owner's notification may queue the owner email",
  );
  assert.match(migration, /New retail order marked paid/);
  assert.match(migration, /New retail order - payment pending/);
  assert.match(migration, /marked paid/i);
  assert.match(migration, /Payment is due later/);
  assert.match(
    migration,
    /CREATE TRIGGER trg_refresh_retail_order_payment_notifications/,
  );
  assert.match(migration, /AFTER UPDATE OF payment_status ON public\.orders/);
  assert.match(settingsView, /Email Notifications/);
  assert.match(settingsView, /Save Email Preferences/);
  assert.match(templates, /"Payment"/);
});

test("owner preferences never suppress customer transactional messages", async () => {
  const migration = await readFile(
    "supabase/migrations/202610150001_owner_email_preferences.sql",
    "utf8",
  );

  assert.match(
    migration,
    /CREATE OR REPLACE FUNCTION public\.enqueue_order_received_after_email/,
  );
  assert.match(migration, /'ORDER_RECEIVED'/);
  assert.doesNotMatch(
    migration.match(
      /CREATE OR REPLACE FUNCTION public\.enqueue_order_received_after_email[\s\S]*?REVOKE ALL ON FUNCTION public\.enqueue_order_received_after_email/,
    )?.[0] ?? "",
    /owner_email_/,
  );
});
