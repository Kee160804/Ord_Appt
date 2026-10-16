import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("platform notifications are recipient scoped and separate from tenant alerts", async () => {
  const migration = await readFile(
    "supabase/migrations/202610160001_platform_admin_notifications.sql",
    "utf8",
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.platform_notifications/);
  assert.match(migration, /recipient_id = auth\.uid\(\) AND public\.is_super_admin\(\)/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.notify_platform_admins/);
  assert.doesNotMatch(migration, /INSERT INTO public\.business_notifications/);
  assert.match(migration, /ALTER PUBLICATION supabase_realtime ADD TABLE public\.platform_notifications/);
});

test("platform monitoring covers signup, tenants, teams, commerce, payments, and privacy", async () => {
  const migration = await readFile(
    "supabase/migrations/202610160001_platform_admin_notifications.sql",
    "utf8",
  );

  for (const trigger of [
    "trg_platform_profile_notification",
    "trg_platform_tenant_notification",
    "trg_platform_team_notification",
    "trg_platform_order_notification",
    "trg_platform_appointment_notification",
    "trg_platform_payment_notification",
  ]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER ${trigger}`));
  }

  assert.match(migration, /TO_REGCLASS\('public\.privacy_requests'\)/);
  assert.match(migration, /CREATE TRIGGER trg_platform_privacy_notification/);
});

test("the admin header uses the live platform notification center", async () => {
  const [adminPage, center, service] = await Promise.all([
    readFile("app/admin/page.tsx", "utf8"),
    readFile("app/components/PlatformNotificationCenter.tsx", "utf8"),
    readFile("app/services/platformNotificationService.ts", "utf8"),
  ]);

  assert.match(adminPage, /<PlatformNotificationCenter userId=\{userId\}/);
  assert.match(center, /table: "platform_notifications"/);
  assert.match(center, /Live events across YuhBusiness/);
  assert.match(service, /markAllPlatformNotificationsRead/);
  assert.doesNotMatch(service, /business_notifications/);
});
