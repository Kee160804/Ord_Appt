import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("signup details flow into the editable storefront identity", async () => {
  const registration = await readFile("app/register/page.tsx", "utf8");
  const auth = await readFile("app/contexts/auth.tsx", "utf8");
  const settings = await readFile("app/components/SettingsView.tsx", "utf8");

  assert.match(
    registration,
    /current\.slug === slugify\(current\.businessName\)/,
  );
  assert.match(registration, /\.yuhbusiness\.com/);
  assert.match(registration, /logoFile/);
  assert.match(auth, /applyPendingBusinessLogo/);
  assert.match(settings, /value=\{slug\}/);
  assert.match(
    settings,
    /Your signup logo and business details are kept in sync here/,
  );
});

test("cover framing persists and renders on public storefronts", async () => {
  const migration = await readFile(
    "supabase/migrations/202609170001_storefront_cover_framing.sql",
    "utf8",
  );
  const settings = await readFile("app/components/SettingsView.tsx", "utf8");
  const service = await readFile("app/services/settingsService.ts", "utf8");
  const booking = await readFile(
    "app/components/AppointmentBooking.tsx",
    "utf8",
  );
  const ordering = await readFile("app/components/OrderingMenu.tsx", "utf8");

  assert.match(migration, /cover_image_position_x/);
  assert.match(migration, /cover_image_position_y/);
  assert.match(migration, /cover_image_zoom/);
  assert.match(migration, /set_default_yuhbusiness_domain/);
  assert.match(settings, /Perfect fit/);
  assert.match(settings, /Left \/ right/);
  assert.match(settings, /Up \/ down/);
  assert.match(service, /customDomain = `\$\{slug\}\.yuhbusiness\.com`/);
  assert.match(booking, /coverImagePositionX/);
  assert.match(ordering, /coverImageZoom/);
});
