BEGIN;

-- Automatic threshold discounts were introduced with an enabled 5%-at-$100
-- default. A discount is a business decision, so new and existing storefronts
-- must remain discount-free until the owner explicitly enables and saves it.
ALTER TABLE public.business_settings
  ALTER COLUMN discount_enabled SET DEFAULT FALSE;

-- Every tenant should have a settings row through initialize_new_tenant().
-- Repair any historical gaps so checkout never falls back to an invented
-- automatic discount.
INSERT INTO public.business_settings (tenant_id)
SELECT tenant.id
FROM public.tenants tenant
ON CONFLICT (tenant_id) DO NOTHING;

-- Disable only the exact legacy automatic values that the old migration
-- populated. Owners can deliberately enable any threshold discount again in
-- Order Operations, at which point it is saved and displayed normally.
UPDATE public.business_settings
SET discount_enabled = FALSE,
    updated_at = NOW()
WHERE discount_enabled = TRUE
  AND discount_threshold = 100
  AND discount_rate = 5;

NOTIFY pgrst, 'reload schema';

COMMIT;
