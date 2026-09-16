import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("canonical market configuration is consistent", async () => {
  const platform = await readFile("app/lib/platform.ts", "utf8");
  const readme = await readFile("README.md", "utf8");
  assert.match(platform, /name: "YuhBusiness"/);
  assert.match(platform, /currency: "BZD"/);
  assert.match(platform, /locale: "en-BZ"/);
  assert.match(platform, /timezone: "America\/Belize"/);
  assert.match(readme, /^# YuhBusiness/m);
  assert.doesNotMatch(readme, /LocalSpace/);
});

test("large operational lists use bounded database ranges", async () => {
  for (const path of [
    "app/services/orderService.ts",
    "app/services/appointmentService.ts",
    "app/services/customerService.ts",
  ]) {
    const source = await readFile(path, "utf8");
    assert.match(
      source,
      /\.range\(from, (?:to|from \+ safePageSize - 1)\)/,
      path,
    );
    assert.match(source, /MAX_[A-Z_]*PAGE_SIZE\s*=\s*\d+/, path);
    assert.match(source, /Math\.min\(/, path);
  }
});

test("production authentication emails cannot emit localhost callbacks", async () => {
  const platform = await readFile("app/lib/platform.ts", "utf8");
  const authService = await readFile("app/services/authService.ts", "utf8");
  const adminAgents = await readFile("app/api/admin/agents/route.ts", "utf8");
  const adminTenants = await readFile("app/api/admin/tenants/route.ts", "utf8");

  assert.match(
    platform,
    /PRODUCTION_APP_ORIGIN = "https:\/\/yuhbusiness\.com"/,
  );
  assert.match(platform, /NODE_ENV === "production"/);
  assert.match(platform, /isLoopbackOrigin/);
  assert.match(authService, /authCallbackUrl/);
  assert.match(adminAgents, /authCallbackUrl/);
  assert.match(adminTenants, /authCallbackUrl/);
  assert.doesNotMatch(adminAgents, /NEXT_PUBLIC_SITE_URL/);
  assert.doesNotMatch(adminAgents, /let appOrigin = "http:\/\/localhost/);
  assert.doesNotMatch(adminTenants, /"http:\/\/localhost:3000"/);
});
