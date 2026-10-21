import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("product editor supports image URLs and local photo uploads", async () => {
  const [view, service, migration] = await Promise.all([
    read("app/components/ProductsView.tsx"),
    read("app/services/productService.ts"),
    read("supabase/migrations/202610200001_product_image_uploads.sql"),
  ]);

  assert.match(view, /label="Image URL"/);
  assert.match(view, /Upload from photos/);
  assert.match(view, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(view, /uploadProductImage/);
  assert.match(view, /productImagePreview/);
  assert.match(service, /validateProductImage/);
  assert.match(service, /\/products\//);
  assert.match(service, /Product images must be 5 MB or smaller/);
  assert.match(migration, /storefront_media_product_insert/);
  assert.match(migration, /user_has_tenant_access/);
});
