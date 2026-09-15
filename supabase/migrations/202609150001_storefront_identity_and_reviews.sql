BEGIN;

-- Persist the public links already represented by the application Tenant type.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_social_links_object,
  ADD CONSTRAINT tenants_social_links_object
    CHECK (JSONB_TYPEOF(social_links) = 'object');

CREATE UNIQUE INDEX IF NOT EXISTS tenants_custom_domain_unique
  ON public.tenants (LOWER(custom_domain))
  WHERE custom_domain IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_tenant_custom_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NEW.custom_domain IS NOT NULL THEN
    NEW.custom_domain := LOWER(TRIM(TRAILING '.' FROM BTRIM(NEW.custom_domain)));
    IF NEW.custom_domain !~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' THEN
      RAISE EXCEPTION 'Enter a valid public custom domain.' USING ERRCODE = '22023';
    END IF;
  END IF;

  IF NEW.custom_domain IS DISTINCT FROM OLD.custom_domain THEN
    NEW.custom_domain_verified_at := NULL;
  ELSIF NEW.custom_domain_verified_at IS DISTINCT FROM OLD.custom_domain_verified_at
    AND auth.role() <> 'service_role'
    AND NOT public.is_super_admin()
  THEN
    RAISE EXCEPTION 'Only a platform administrator can verify a custom domain.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tenant_custom_domain ON public.tenants;
CREATE TRIGGER trg_guard_tenant_custom_domain
BEFORE UPDATE OF custom_domain, custom_domain_verified_at ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_custom_domain();

-- Keep custom domains behind the same plan gate as the existing storefront
-- URL, identity, and brand controls.
CREATE OR REPLACE FUNCTION public.enforce_storefront_branding_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role() = 'service_role', FALSE)
     OR public.is_super_admin()
     OR public.tenant_plan_has_feature(NEW.id, 'storefront_branding')
  THEN
    RETURN NEW;
  END IF;

  IF NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.subdomain IS DISTINCT FROM OLD.subdomain
     OR NEW.cover_image IS DISTINCT FROM OLD.cover_image
     OR NEW.primary_color IS DISTINCT FROM OLD.primary_color
     OR NEW.accent_color IS DISTINCT FROM OLD.accent_color
     OR NEW.social_links IS DISTINCT FROM OLD.social_links
     OR NEW.custom_domain IS DISTINCT FROM OLD.custom_domain
  THEN
    RAISE EXCEPTION 'Storefront identity, custom domain, cover image, and brand colours are available on the Pro plan.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Reviews can now belong to a specific service instead of being an unscoped
-- tenant testimonial. Existing rows remain valid tenant-level reviews.
ALTER TABLE public.business_reviews
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Older YuhBusiness projects named these fields review/is_visible. Copy those
-- values into the canonical fields without requiring the legacy columns to
-- exist on fresh installations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_reviews'
      AND column_name = 'review'
  ) THEN
    EXECUTE 'UPDATE public.business_reviews
             SET body = review
             WHERE body IS NULL AND review IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_reviews'
      AND column_name = 'is_visible'
  ) THEN
    EXECUTE 'UPDATE public.business_reviews
             SET is_published = COALESCE(is_visible, FALSE)';
  END IF;
END;
$$;

UPDATE public.business_reviews
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE public.business_reviews
SET is_published = FALSE
WHERE is_published IS NULL;

ALTER TABLE public.business_reviews
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN is_published SET DEFAULT FALSE,
  ALTER COLUMN is_published SET NOT NULL;

-- Keep legacy and canonical review fields synchronized during a rolling app
-- deployment. jsonb_populate_record ignores keys that do not exist on fresh
-- schemas, so this same trigger is safe for both database shapes.
CREATE OR REPLACE FUNCTION public.sync_business_review_compatibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row JSONB := TO_JSONB(NEW);
BEGIN
  IF NEW.body IS NULL AND v_row ? 'review' THEN
    NEW.body := NULLIF(v_row ->> 'review', '');
  END IF;

  IF v_row ? 'is_visible' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.is_published := COALESCE((v_row ->> 'is_visible')::BOOLEAN, FALSE);
    ELSIF NEW.is_published IS NOT DISTINCT FROM OLD.is_published THEN
      NEW.is_published := COALESCE((v_row ->> 'is_visible')::BOOLEAN, FALSE);
    END IF;
  END IF;

  NEW := JSONB_POPULATE_RECORD(
    NEW,
    JSONB_BUILD_OBJECT(
      'review', NEW.body,
      'is_visible', NEW.is_published
    )
  );
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_business_review_compatibility
  ON public.business_reviews;
CREATE TRIGGER trg_sync_business_review_compatibility
BEFORE INSERT OR UPDATE ON public.business_reviews
FOR EACH ROW EXECUTE FUNCTION public.sync_business_review_compatibility();

ALTER TABLE public.business_reviews
  DROP CONSTRAINT IF EXISTS business_reviews_reviewer_name_length,
  ADD CONSTRAINT business_reviews_reviewer_name_length
    CHECK (reviewer_name IS NULL OR CHAR_LENGTH(reviewer_name) <= 120),
  DROP CONSTRAINT IF EXISTS business_reviews_body_length,
  ADD CONSTRAINT business_reviews_body_length
    CHECK (body IS NULL OR CHAR_LENGTH(body) <= 4000);

CREATE INDEX IF NOT EXISTS business_reviews_public_service_idx
  ON public.business_reviews (tenant_id, service_id, created_at DESC)
  WHERE is_published;

CREATE OR REPLACE FUNCTION public.enforce_review_service_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.service_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.services
    WHERE services.id = NEW.service_id
      AND services.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'The review service must belong to the same business.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_review_service_tenant ON public.business_reviews;
CREATE TRIGGER trg_enforce_review_service_tenant
BEFORE INSERT OR UPDATE OF tenant_id, service_id ON public.business_reviews
FOR EACH ROW EXECUTE FUNCTION public.enforce_review_service_tenant();

DROP POLICY IF EXISTS public_reviews ON public.business_reviews;
CREATE POLICY public_reviews
ON public.business_reviews
FOR SELECT TO anon
USING (
  is_published
  AND rating BETWEEN 1 AND 5
  AND NULLIF(BTRIM(body), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE tenants.id = business_reviews.tenant_id
      AND tenants.is_active
      AND UPPER(tenants.status) = 'ACTIVE'
  )
);

COMMIT;
