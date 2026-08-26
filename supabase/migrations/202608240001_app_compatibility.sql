BEGIN;

-- Columns consumed by the Next.js application. These statements are safe to
-- run after the supplied LocalSpace evolution script.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS business_type TEXT DEFAULT 'appointment',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS logo TEXT,
  ADD COLUMN IF NOT EXISTS logo_bg TEXT,
  ADD COLUMN IF NOT EXISTS cover_image TEXT,
  ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#8b5cf6',
  ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '#a78bfa',
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS stripe_connected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

UPDATE public.tenants t
SET business_type = CASE
  WHEN EXISTS (
    SELECT 1
    FROM public.business_modules bm
    WHERE bm.tenant_id = t.id
      AND bm.ordering = TRUE
  ) THEN 'ordering'
  ELSE 'appointment'
END
WHERE business_type IS NULL
   OR LOWER(business_type) NOT IN ('appointment', 'ordering');

ALTER TABLE public.tenants
  ALTER COLUMN business_type SET DEFAULT 'appointment',
  ALTER COLUMN business_type SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique
  ON public.tenants (LOWER(slug));

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS requires_deposit BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS deposit_type TEXT;

-- Public storefront server reads use an anonymous Supabase client. Do not add
-- equivalent authenticated policies: those would let one tenant read another
-- tenant's active catalog directly through the Data API.
DROP POLICY IF EXISTS public_tenants_select_authenticated_policy ON public.tenants;
DROP POLICY IF EXISTS public_settings_select_authenticated_policy ON public.business_settings;
DROP POLICY IF EXISTS public_hours_select_authenticated_policy ON public.business_hours;
DROP POLICY IF EXISTS public_categories_select_authenticated_policy ON public.categories;
DROP POLICY IF EXISTS public_products_select_authenticated_policy ON public.products;
DROP POLICY IF EXISTS public_services_select_authenticated_policy ON public.services;

GRANT SELECT ON public.tenants, public.business_settings, public.business_modules,
  public.business_hours, public.categories, public.products, public.services,
  public.staff, public.staff_services, public.business_reviews
TO anon, authenticated;

COMMIT;
