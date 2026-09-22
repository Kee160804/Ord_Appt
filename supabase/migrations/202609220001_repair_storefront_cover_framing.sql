BEGIN;

-- The storefront form always persists these framing values, even when no new
-- cover image is uploaded. Keep this repair idempotent for databases where the
-- original cover-framing migration was skipped.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cover_image_position_x SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_image_position_y SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_image_zoom SMALLINT NOT NULL DEFAULT 100;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_cover_image_position_x_check,
  DROP CONSTRAINT IF EXISTS tenants_cover_image_position_y_check,
  DROP CONSTRAINT IF EXISTS tenants_cover_image_zoom_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_cover_image_position_x_check
    CHECK (cover_image_position_x BETWEEN 0 AND 100),
  ADD CONSTRAINT tenants_cover_image_position_y_check
    CHECK (cover_image_position_y BETWEEN 0 AND 100),
  ADD CONSTRAINT tenants_cover_image_zoom_check
    CHECK (cover_image_zoom BETWEEN 100 AND 200);

NOTIFY pgrst, 'reload schema';

COMMIT;
