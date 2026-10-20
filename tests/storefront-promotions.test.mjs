import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("storefront navigation separates the catalog, about, promotions, and contact", async () => {
  const source = await read("app/components/store.tsx");
  assert.match(
    source,
    /type StorefrontTab = "catalog" \| "about" \| "promotions" \| "contact"/,
  );
  assert.doesNotMatch(source, />\s*Home\s*</);
  assert.match(source, /<StorefrontAbout tenant=\{tenant\}/);
  assert.match(source, /<StorefrontPromotions/);
  assert.match(source, /getElementById\("storefront-search"\)/);
});

test("owners can save About text and upload and share promotion flyers", async () => {
  const [settings, tools, service] = await Promise.all([
    read("app/components/SettingsView.tsx"),
    read("app/components/BusinessToolsView.tsx"),
    read("app/services/businessToolsService.ts"),
  ]);
  assert.match(settings, /label="About your business"/);
  assert.match(tools, /feature="storefront_promotions"/);
  assert.match(tools, /uploadPromotionFlyer/);
  assert.match(tools, /url\.searchParams\.set\("tab", "promotions"\)/);
  assert.match(service, /\$\{tenantId\}\/promotions\//);
  assert.match(service, /flyer_url: promotion\.flyerUrl/);
});

test("promotion migration adds schema, public lookup, storage policy, and plan enforcement", async () => {
  const migration = await read(
    "supabase/migrations/202610150002_storefront_promotions_and_about.sql",
  );
  assert.match(migration, /ADD COLUMN IF NOT EXISTS about_text TEXT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS flyer_url TEXT/);
  assert.match(migration, /WHEN 'storefront_promotions'/);
  assert.match(migration, /trg_storefront_promotions_plan/);
  assert.match(migration, /list_public_storefront_promotions/);
  assert.match(migration, /storefront_media_promotion_owner_insert/);
});

test("Pro and Enterprise pricing list promotion codes and flyers", async () => {
  const [catalog, pricing] = await Promise.all([
    read("app/lib/plan-catalog.mjs"),
    read("app/home/page.tsx"),
  ]);
  assert.match(catalog, /"storefront_promotions"/);
  assert.ok(
    catalog.match(/Promotion codes, flyer uploads, and shareable promo pages/g)
      ?.length >= 2,
  );
  assert.ok(
    pricing.match(/Promotion codes, flyer uploads, and shareable promo pages/g)
      ?.length >= 2,
  );
});

test("owners can customize the public contact page and preview their changes", async () => {
  const [contact, designer, designParser, socialLinks] = await Promise.all([
    read("app/components/StorefrontContact.tsx"),
    read("app/components/StorefrontDesigner.tsx"),
    read("app/lib/storefront-design.ts"),
    read("app/lib/social-links.ts"),
  ]);

  assert.match(contact, /design\.contactHeading/);
  assert.match(contact, /design\.contactDescription/);
  assert.match(contact, /mapHref\(design\.contactMapUrl, location\)/);
  assert.match(contact, /tenant\.coverImage/);
  assert.match(designer, /Contact page content/);
  assert.match(designer, /Contact information/);
  assert.match(designer, /Maps share URL/);
  assert.match(designer, /design\.contactMapUrl/);
  assert.match(designer, /updateBusinessDetails/);
  assert.match(designer, /ContactPagePreview/);
  assert.match(designer, /label=\{platform\.label\}/);
  assert.match(designer, /contactSection === "social"/);
  assert.match(designer, /sm:grid-cols-2/);
  assert.match(designer, /visibleSocials/);
  assert.match(designParser, /contactResponseText/);
  assert.match(designParser, /contactTrustText/);
  assert.match(designParser, /contactMapUrl/);
  assert.match(designParser, /STOREFRONT_SOCIAL_PLATFORMS/);
  assert.match(contact, /Business Hours/);
  assert.match(contact, /Find Us Online/);
  assert.match(contact, /WhatsApp/);
  assert.match(contact, /TikTok/);
  assert.match(contact, /YouTube/);
  assert.match(socialLinks, /"whatsapp"/);
  assert.match(socialLinks, /"tiktok"/);
  assert.match(socialLinks, /"youtube"/);
});

test("storefront desktop and mobile previews follow the active dashboard theme", async () => {
  const designer = await read("app/components/StorefrontDesigner.tsx");

  assert.match(designer, /const \{ theme \} = useTheme\(\)/);
  assert.match(designer, /theme=\{theme\}/);
  assert.match(designer, /theme === "light"/);
  assert.match(designer, /mobile=\{previewMode === "mobile"\}/);
});
