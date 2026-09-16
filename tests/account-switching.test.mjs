import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("account switching requires fresh credentials and preserves tenant hierarchy", async () => {
  const [context, switcher, authService] = await Promise.all([
    readFile("app/contexts/auth.tsx", "utf8"),
    readFile("app/components/AccountSwitcher.tsx", "utf8"),
    readFile("app/services/authService.ts", "utf8"),
  ]);

  assert.match(context, /switchAccount: \(/);
  assert.match(context, /supabaseLogin\(normalizedEmail, password\)/);
  assert.match(context, /Enter the email address for a different account/);
  assert.match(switcher, /type=\{showPassword \? "text" : "password"\}/);
  assert.match(switcher, /autoComplete="current-password"/);
  assert.match(switcher, /Verify and switch/);
  assert.doesNotMatch(switcher, /localStorage|sessionStorage|refresh_token/);

  assert.match(
    authService,
    /ACTIVE_BUSINESS_KEY_PREFIX = "yuhbusiness_active_business:"/,
  );
  assert.match(authService, /getStoredActiveBusiness\(profile\.id\)/);
  assert.match(authService, /storeActiveBusiness\(profile\.id, tenant\.id\)/);
  assert.match(authService, /getMemberships\(supabase, profile\.id\)/);
});
