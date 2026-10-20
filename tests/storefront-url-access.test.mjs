import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("storefront URL editing is locked by default and enforced in the database", async () => {
  const migration = await read(
    "supabase/migrations/202610190002_storefront_url_edit_access.sql",
  );

  assert.match(
    migration,
    /allow_storefront_url_edit BOOLEAN NOT NULL DEFAULT FALSE/,
  );
  assert.match(migration, /NEW\.slug IS DISTINCT FROM OLD\.slug/);
  assert.match(migration, /NEW\.subdomain IS DISTINCT FROM OLD\.subdomain/);
  assert.match(
    migration,
    /NEW\.custom_domain IS DISTINCT FROM OLD\.custom_domain/,
  );
  assert.match(migration, /public\.is_super_admin\(\)/);
  assert.match(migration, /trg_guard_tenant_storefront_url_fields/);
});

test("owners see a locked URL while platform admins can grant access", async () => {
  const [designer, settingsService, adminPage, adminApi] = await Promise.all([
    read("app/components/StorefrontDesigner.tsx"),
    read("app/services/settingsService.ts"),
    read("app/admin/tenant/[Id]/page.tsx"),
    read("app/api/admin/tenants/[tenantId]/domain/route.ts"),
  ]);

  assert.match(designer, /disabled=\{!tenant\.storefrontUrlEditAllowed\}/);
  assert.match(designer, /reserved when the business was/);
  assert.match(settingsService, /input\.storefrontUrlEditAllowed/);
  assert.match(settingsService, /\.\.\.\(input\.storefrontUrlEditAllowed/);
  assert.match(adminPage, /Allow URL editing/);
  assert.match(adminPage, /Lock URL editing/);
  assert.match(adminApi, /authorizeActiveSuperAdmin/);
  assert.match(adminApi, /allow_storefront_url_edit/);
});
