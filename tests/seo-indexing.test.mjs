import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("inactive or deleted storefronts resolve as real 404 pages", async () => {
  const [page, service, proxy] = await Promise.all([
    readFile("app/store-front/[slug]/page.tsx", "utf8"),
    readFile("app/services/storefrontService.ts", "utf8"),
    readFile("proxy.ts", "utf8"),
  ]);

  assert.match(page, /if \(!storefront\) notFound\(\)/);
  assert.match(page, /generateMetadata[\s\S]*if \(!storefront\) notFound\(\)/);
  assert.match(page, /if \(!tenant \|\| !tenant\.isActive\)/);
  assert.match(service, /\.eq\("is_active", true\)/);
  assert.match(service, /\.eq\("status", "ACTIVE"\)/);
  assert.match(proxy, /publicStorefrontExists/);
  assert.match(proxy, /status: 404/);
});

test("the sitemap uses only the active public storefront query", async () => {
  const [sitemap, service] = await Promise.all([
    readFile("app/sitemap.ts", "utf8"),
    readFile("app/services/storefrontService.ts", "utf8"),
  ]);

  assert.match(sitemap, /listPublicStorefrontEntries/);
  assert.doesNotMatch(sitemap, /privacy\/request/);
  assert.match(service, /\.eq\("is_active", true\)/);
  assert.match(service, /\.eq\("status", "ACTIVE"\)/);
});

test("private routes carry noindex metadata and response headers", async () => {
  const [dashboard, admin, forgot, reset, config] = await Promise.all([
    readFile("app/dashboard/layout.tsx", "utf8"),
    readFile("app/admin/layout.tsx", "utf8"),
    readFile("app/forgot-password/layout.tsx", "utf8"),
    readFile("app/reset-password/layout.tsx", "utf8"),
    readFile("next.config.ts", "utf8"),
  ]);

  for (const route of [dashboard, admin, forgot, reset]) {
    assert.match(route, /index: false/);
  }
  assert.match(config, /X-Robots-Tag/);
  assert.match(config, /\/dashboard\/:path\*/);
  assert.match(config, /\/admin\/:path\*/);
});

test("public pages have canonicals and a working favicon route", async () => {
  const [home, privacy, terms, storefront, favicon, rootLayout] =
    await Promise.all([
      readFile("app/home/layout.tsx", "utf8"),
      readFile("app/privacy/page.tsx", "utf8"),
      readFile("app/terms/page.tsx", "utf8"),
      readFile("app/store-front/[slug]/page.tsx", "utf8"),
      readFile("app/favicon.ico/route.ts", "utf8"),
      readFile("app/layout.tsx", "utf8"),
    ]);

  assert.match(home, /canonical: "\/"/);
  assert.match(privacy, /canonical: "\/privacy"/);
  assert.match(terms, /canonical: "\/terms"/);
  assert.match(storefront, /alternates: \{ canonical \}/);
  assert.match(favicon, /Content-Type": "image\/svg\+xml/);
  assert.match(rootLayout, /\/favicon\.ico/);
});
