import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("storefront identity migration is additive and tenant safe", async () => {
  const sql = await readFile(
    "supabase/migrations/202609150001_storefront_identity_and_reviews.sql",
    "utf8",
  );
  assert.match(sql, /ADD COLUMN IF NOT EXISTS social_links JSONB/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS custom_domain TEXT/);
  assert.match(sql, /custom_domain_verified_at IS DISTINCT/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS service_id UUID/);
  assert.match(sql, /enforce_review_service_tenant/);
  assert.match(sql, /business_reviews\.tenant_id/);
});

test("public reviews replace the placeholder and remain publication filtered", async () => {
  const loader = await readFile("app/services/storefrontService.ts", "utf8");
  const booking = await readFile(
    "app/components/AppointmentBooking.tsx",
    "utf8",
  );
  assert.match(loader, /\.eq\("is_published", true\)/);
  assert.match(loader, /\.eq\("tenant_id", tenantRow\.id\)/);
  assert.match(booking, /serviceReviews/);
  assert.doesNotMatch(booking, /FAKE_REVIEWS/);
});

test("PWA and route-level resilience assets are present", async () => {
  for (const path of [
    "app/robots.ts",
    "app/error.tsx",
    "app/global-error.tsx",
    "app/not-found.tsx",
    "app/loading.tsx",
    "public/offline.html",
    "public/icon-192.png",
    "public/icon-512.png",
    "public/apple-touch-icon.png",
    "public/fallback-product.png",
  ]) {
    const content = await readFile(path);
    assert.ok(content.length > 0, `${path} should not be empty`);
  }
});
