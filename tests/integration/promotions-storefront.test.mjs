import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migrationPath =
  "supabase/migrations/202609220002_promotion_storefront_fixes.sql";
const discountOptInMigrationPath =
  "supabase/migrations/202609230002_discounts_are_owner_opt_in.sql";
const discountScopeMigrationPath =
  "supabase/migrations/202610160004_promotion_discount_scope.sql";

test("retail checkout applies promotions and owner automatic discounts atomically", async () => {
  const [sql, route] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("app/api/public/orders/route.ts", "utf8"),
  ]);

  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.create_public_retail_order_v2/,
  );
  assert.match(sql, /p_promotion_code TEXT DEFAULT NULL/);
  assert.match(sql, /discount_enabled/);
  assert.match(sql, /discount_threshold/);
  assert.match(sql, /discount_rate/);
  assert.match(sql, /public\.apply_public_order_promotion/);
  assert.match(sql, /GRANT EXECUTE[\s\S]+TO service_role/);

  assert.match(route, /create_public_retail_order_v2/);
  assert.match(route, /p_promotion_code: payload\.p_promotion_code/);
  assert.match(
    route,
    /error\?\.code === "PGRST202" && isRetail && promotionCode/,
  );
});

test("active owner promotions are discoverable and rendered on both storefront types", async () => {
  const [sql, loader, store, ordering, booking] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("app/services/storefrontService.ts", "utf8"),
    readFile("app/components/store.tsx", "utf8"),
    readFile("app/components/OrderingMenu.tsx", "utf8"),
    readFile("app/components/AppointmentBooking.tsx", "utf8"),
  ]);

  assert.match(sql, /list_public_storefront_promotions/);
  assert.match(sql, /promotion\.is_active = TRUE/);
  assert.match(
    sql,
    /promotion\.starts_at IS NULL OR promotion\.starts_at <= NOW\(\)/,
  );
  assert.match(
    sql,
    /promotion\.ends_at IS NULL OR promotion\.ends_at > NOW\(\)/,
  );
  assert.match(sql, /TO anon, authenticated, service_role/);
  assert.match(loader, /list_public_storefront_promotions/);
  assert.match(store, /initialPromotions/);
  assert.match(ordering, /<StorefrontOffers/);
  assert.match(ordering, /automaticDiscount=/);
  assert.match(booking, /<StorefrontOffers/);
  assert.match(booking, /validatePromotion/);
});

test("promotion codes use one canonical validation contract from owner form to checkout", async () => {
  const [shared, ownerService, ownerView, publicRoute] = await Promise.all([
    readFile("app/lib/promotions.ts", "utf8"),
    readFile("app/services/businessToolsService.ts", "utf8"),
    readFile("app/components/BusinessToolsView.tsx", "utf8"),
    readFile("app/api/public/promotions/route.ts", "utf8"),
  ]);

  assert.match(shared, /\^\[A-Z0-9_-\]\{2,32\}\$/);
  assert.match(ownerService, /isValidPromotionCode/);
  assert.match(ownerView, /MAX_PROMOTION_CODE_LENGTH/);
  assert.match(ownerView, /normalizePromotionCode/);
  assert.match(publicRoute, /isValidPromotionCode/);
});

test("storefront discounts remain hidden until the business owner enables one", async () => {
  const [sql, settingsService, storefrontService, ordering, settings] =
    await Promise.all([
      readFile(discountOptInMigrationPath, "utf8"),
      readFile("app/services/settingsService.ts", "utf8"),
      readFile("app/services/storefrontService.ts", "utf8"),
      readFile("app/components/OrderingMenu.tsx", "utf8"),
      readFile("app/components/SettingsView.tsx", "utf8"),
    ]);

  assert.match(sql, /ALTER COLUMN discount_enabled SET DEFAULT FALSE/);
  assert.match(sql, /SET discount_enabled = FALSE/);
  assert.match(settingsService, /discount_enabled === true/);
  assert.match(storefrontService, /discount_enabled === true/);
  assert.match(ordering, /discountEnabled: false/);
  assert.match(settings, /discountEnabled: false/);
});

test("owners choose total or item-scoped promotions and checkout previews them immediately", async () => {
  const [sql, ownerView, ownerService, ordering, checkout] = await Promise.all([
    readFile(discountScopeMigrationPath, "utf8"),
    readFile("app/components/BusinessToolsView.tsx", "utf8"),
    readFile("app/services/businessToolsService.ts", "utf8"),
    readFile("app/components/OrderingMenu.tsx", "utf8"),
    readFile("app/components/CustomerPaymentCheckout.tsx", "utf8"),
  ]);

  assert.match(sql, /ADD COLUMN IF NOT EXISTS discount_scope TEXT/);
  assert.match(sql, /discount_scope IN \('TOTAL', 'ITEMS'\)/);
  assert.match(sql, /v_scope = 'TOTAL'/);
  assert.match(sql, /item\.product_id = ANY\(v_applicable\)/);
  assert.match(sql, /'discountScope', v_promo\.discount_scope/);
  assert.match(ownerView, /label="Apply discount to"/);
  assert.match(ownerView, /Entire purchase total/);
  assert.match(ownerView, /Selected item\(s\)/);
  assert.match(ownerService, /discount_scope: promotion\.discountScope/);
  assert.match(ordering, /validated\.discountScope === "ITEMS"/);
  assert.match(checkout, /You save/);
  assert.match(checkout, /promotionDiscount/);
});
