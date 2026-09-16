import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = {
  tenantDelete: "app/api/admin/tenants/[tenantId]/route.ts",
  agentDelete: "app/api/admin/agents/[agentId]/route.ts",
  migration: "supabase/migrations/202609150003_account_deletion_integrity.sql",
  adminPage: "app/admin/page.tsx",
};

test("tenant deletion is super-admin protected and preserves multi-business accounts", async () => {
  const source = await readFile(files.tenantDelete, "utf8");

  assert.match(source, /authorizeActiveSuperAdmin/);
  assert.match(source, /requestHasAllowedOrigin/);
  assert.match(source, /delete_platform_tenant/);
  assert.match(source, /tenant_memberships/);
  assert.match(source, /deleteUser/);
  assert.match(source, /count.*> 0|\(count \?\? 0\) > 0/);
});

test("account deletion protects the active admin and last business owner", async () => {
  const source = await readFile(files.agentDelete, "utf8");

  assert.match(source, /agentId === callerId/);
  assert.match(source, /only active super admin/i);
  assert.match(source, /Transfer ownership or delete these businesses first/);
  assert.match(source, /auth\.admin\.deleteUser/);
});

test("account lifecycle migration keeps auth and public records linked", async () => {
  const source = await readFile(files.migration, "utf8");

  assert.match(source, /profiles_id_fkey/);
  assert.match(source, /REFERENCES auth\.users\(id\)[\s\S]*ON DELETE CASCADE/);
  assert.match(source, /delete_platform_tenant/);
  assert.match(source, /REVOKE ALL[\s\S]*PUBLIC, anon, authenticated/);
  assert.match(source, /TO service_role/);
});

test("admin destructive actions require typed confirmation", async () => {
  const source = await readFile(files.adminPage, "utf8");

  assert.match(source, /DeleteConfirmationModal/);
  assert.match(source, /confirmation\.trim\(\) === entityName/);
  assert.match(source, /Delete permanently/);
});
