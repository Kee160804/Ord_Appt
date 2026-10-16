import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("enabled profiles without any assignment are shown as pending", async () => {
  const [service, page] = await Promise.all([
    readFile("app/services/adminService.ts", "utf8"),
    readFile("app/admin/page.tsx", "utf8"),
  ]);

  assert.match(service, /!isSuperAdmin && !membership/);
  assert.match(service, /\? "pending"/);
  assert.match(page, /<option value="pending">Pending<\/option>/);
  assert.match(page, /<AgentStatusBadge status=\{agent\.status\}/);
});
