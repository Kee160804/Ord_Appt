import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("storefront designer persists flexible design settings and logo uploads", () => {
  const designer = read("app/components/StorefrontDesigner.tsx");
  const service = read("app/services/settingsService.ts");
  const migration = read(
    "supabase/migrations/202610160006_storefront_design_builder.sql",
  );

  assert.match(designer, /Live Preview/);
  assert.match(designer, /Desktop/);
  assert.match(designer, /Mobile/);
  assert.match(designer, /uploadBusinessLogo/);
  assert.match(designer, /Storefront layout/);
  assert.match(service, /storefront_design: storefrontDesign/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS storefront_design JSONB/);
});

test("public storefront and settings preview share the same hero renderer", () => {
  const designer = read("app/components/StorefrontDesigner.tsx");
  const ordering = read("app/components/OrderingMenu.tsx");
  const appointments = read("app/components/AppointmentBooking.tsx");
  const hero = read("app/components/StorefrontHero.tsx");

  assert.match(designer, /<StorefrontHero tenant={tenant} compact/);
  assert.match(ordering, /<StorefrontHero/);
  assert.match(appointments, /<StorefrontHero/);
  assert.match(hero, /design\.heroHeading/);
  assert.match(hero, /design\.heroAccent/);
});
