BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS storefront_design JSONB NOT NULL DEFAULT '{
    "heroAlignment": "left",
    "heroStyle": "balanced",
    "backgroundStyle": "dark",
    "sections": {
      "hero": true,
      "search": true,
      "categories": true,
      "promotions": true,
      "featured": true,
      "reviews": true,
      "about": true,
      "contact": true
    }
  }'::jsonb;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_storefront_design_object_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_storefront_design_object_check
  CHECK (jsonb_typeof(storefront_design) = 'object');

COMMIT;
