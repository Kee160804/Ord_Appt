import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("storefront subdomains expose consistent Google discovery signals", async () => {
  const [proxy, sitemap, storefront, subdomainSitemap, robots, platform] =
    await Promise.all([
      readFile("proxy.ts", "utf8"),
      readFile("app/sitemap.ts", "utf8"),
      readFile("app/store-front/[slug]/page.tsx", "utf8"),
      readFile("app/store-front/[slug]/sitemap.xml/route.ts", "utf8"),
      readFile("app/store-front/[slug]/robots.txt/route.ts", "utf8"),
      readFile("app/lib/platform.ts", "utf8"),
    ]);

  assert.ok(proxy.includes('"/robots.txt", "/sitemap.xml"'));
  assert.ok(proxy.includes("store-front/${encodeURIComponent(slug)}"));
  assert.match(sitemap, /listPublicStorefrontEntries/);
  assert.match(sitemap, /storefrontUrl/);
  assert.doesNotMatch(sitemap, /\/businesses/);
  assert.match(storefront, /"@type": "LocalBusiness"/);
  assert.match(storefront, /openingHoursSpecification/);
  assert.match(storefront, /alternates: \{ canonical \}/);
  assert.match(subdomainSitemap, /<urlset/);
  assert.match(subdomainSitemap, /storefrontUrl/);
  assert.match(robots, /Sitemap:/);
  assert.ok(platform.includes("${normalizedSlug}.${rootDomain}"));
});

test("privacy requests have a protected case workflow and audit trail", async () => {
  const [sql, publicRoute, adminRoute, form, adminView, email] =
    await Promise.all([
      readFile(
        "supabase/migrations/202609230001_privacy_request_operations.sql",
        "utf8",
      ),
      readFile("app/api/privacy/requests/route.ts", "utf8"),
      readFile("app/api/admin/privacy-requests/route.ts", "utf8"),
      readFile("app/components/PrivacyRequestForm.tsx", "utf8"),
      readFile("app/components/AdminPrivacyRequests.tsx", "utf8"),
      readFile("app/lib/email/templates.ts", "utf8"),
    ]);

  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.privacy_requests/);
  assert.match(
    sql,
    /CREATE TABLE IF NOT EXISTS public\.privacy_request_events/,
  );
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /public\.is_super_admin\(\)/);
  assert.match(
    sql,
    /REVOKE ALL ON public\.privacy_requests, public\.privacy_request_events/,
  );
  assert.match(sql, /check_platform_public_rate_limit/);
  assert.match(sql, /trg_privacy_request_submitted/);
  assert.match(sql, /trg_privacy_request_updated/);
  assert.match(publicRoute, /requestHasAllowedOrigin/);
  assert.match(publicRoute, /enforcePlatformRateLimit/);
  assert.match(publicRoute, /PRIVACY_REQUEST_RECEIVED/);
  assert.match(adminRoute, /authorizeActiveSuperAdmin/);
  assert.match(adminRoute, /requestHasAllowedOrigin/);
  assert.match(adminRoute, /readJsonBody/);
  assert.match(adminRoute, /IDENTITY_VERIFICATION/);
  assert.match(form, /Submit privacy request/);
  assert.match(adminView, /Privacy request queue/);
  assert.match(email, /We received your privacy request/);
});
