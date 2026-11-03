import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("subscription emails use one deduplicated owner queue path", async () => {
  const [migration, worker, templates] = await Promise.all([
    readFile(
      "supabase/migrations/202610300004_subscription_email_deduplication.sql",
      "utf8",
    ),
    readFile("app/lib/email/worker.ts", "utf8"),
    readFile("app/lib/email/templates.ts", "utf8"),
  ]);

  assert.match(migration, /'SUBSCRIPTION_RENEWED'/);
  assert.match(migration, /'SUBSCRIPTION_EXPIRING'/);
  assert.match(
    migration,
    /NEW\.current_period_end IS NOT DISTINCT FROM OLD\.current_period_end/,
  );
  assert.match(migration, /subscription-expiring\/' \|\| tenant\.id::TEXT/);
  assert.match(migration, /ON CONFLICT \(idempotency_key\) DO NOTHING/);
  assert.match(
    migration,
    /NEW\.source_table IN \('storefront_contact_messages', 'tenants'\)/,
    "subscription notification rows must not also create generic business-alert emails",
  );

  assert.match(worker, /job\.event_type === "SUBSCRIPTION_EXPIRING"/);
  assert.match(worker, /queuedPeriodEnd !== currentPeriodEnd/);
  assert.match(templates, /"SUBSCRIPTION_RENEWED"/);
  assert.match(templates, /"SUBSCRIPTION_EXPIRING"/);
  assert.match(templates, /Subscription ending soon/);
});

test("expiry reminders cover trials and active paid periods only", async () => {
  const migration = await readFile(
    "supabase/migrations/202610300004_subscription_email_deduplication.sql",
    "utf8",
  );

  assert.match(migration, /subscription_status, 'trial'\)\) = 'trial'/);
  assert.match(migration, /subscription_status, ''\)\) = 'active'/);
  assert.match(
    migration,
    /tenant\.current_period_end <= NOW\(\) \+ INTERVAL '3 days'/,
  );
  assert.match(
    migration,
    /tenant\.trial_ends_at <= NOW\(\) \+ INTERVAL '3 days'/,
  );
});
