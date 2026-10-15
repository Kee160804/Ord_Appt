BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS about_text TEXT;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_about_text_length_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_about_text_length_check
  CHECK (about_text IS NULL OR CHAR_LENGTH(about_text) <= 3000);

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS flyer_url TEXT;

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_flyer_url_check;
ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_flyer_url_check
  CHECK (flyer_url IS NULL OR flyer_url ~* '^https?://');

-- Promotions and flyer publishing are Pro/Enterprise capabilities. Active
-- trials retain all premium features, matching the application plan contract.
CREATE OR REPLACE FUNCTION public.tenant_plan_has_feature(
  p_tenant_id UUID,
  p_feature TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH entitlement AS (
    SELECT public.tenant_effective_entitlements(p_tenant_id) AS value
  )
  SELECT COALESCE(
    (value->>'hasAccess')::BOOLEAN
    AND CASE LOWER(COALESCE(p_feature, ''))
      WHEN 'detailed_analytics' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'advanced_catalog' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'product_variants' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'booking_deposits' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'storefront_branding' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'storefront_contact_form' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'storefront_promotions' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'team_management' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      ELSE FALSE
    END,
    FALSE
  )
  FROM entitlement;
$$;

REVOKE ALL ON FUNCTION public.tenant_plan_has_feature(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_plan_has_feature(UUID, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_storefront_promotion_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID := NEW.tenant_id;
BEGIN
  IF COALESCE((SELECT auth.role()) = 'service_role', FALSE)
     OR public.is_super_admin()
     OR public.tenant_plan_has_feature(v_tenant_id, 'storefront_promotions') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Storefront promotions are available on the Pro plan.'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_storefront_promotion_plan()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_storefront_promotions_plan ON public.promotions;
CREATE TRIGGER trg_storefront_promotions_plan
BEFORE INSERT OR UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.enforce_storefront_promotion_plan();

-- Public discovery omits usage counts and returns only currently redeemable
-- promotions belonging to a Pro/Enterprise business or an active trial.
DROP FUNCTION IF EXISTS public.list_public_storefront_promotions(UUID);
CREATE FUNCTION public.list_public_storefront_promotions(
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
  description TEXT,
  flyer_url TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  applicable_product_ids UUID[],
  applicable_service_ids UUID[]
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    promotion.id,
    UPPER(promotion.code),
    promotion.name,
    promotion.description,
    promotion.flyer_url,
    promotion.discount_type,
    promotion.discount_value,
    promotion.starts_at,
    promotion.ends_at,
    promotion.applicable_product_ids,
    promotion.applicable_service_ids
  FROM public.promotions promotion
  WHERE promotion.tenant_id = p_tenant_id
    AND promotion.is_active = TRUE
    AND (promotion.starts_at IS NULL OR promotion.starts_at <= NOW())
    AND (promotion.ends_at IS NULL OR promotion.ends_at > NOW())
    AND (
      promotion.usage_limit IS NULL
      OR promotion.usage_count < promotion.usage_limit
    )
    AND EXISTS (
      SELECT 1
      FROM public.tenants tenant
      WHERE tenant.id = promotion.tenant_id
        AND tenant.is_active = TRUE
        AND UPPER(COALESCE(tenant.status, 'ACTIVE')) = 'ACTIVE'
        AND public.tenant_plan_has_feature(
          tenant.id,
          'storefront_promotions'
        )
    )
  ORDER BY promotion.created_at DESC
  LIMIT 25;
$$;

REVOKE ALL ON FUNCTION public.list_public_storefront_promotions(UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_storefront_promotions(UUID)
  TO anon, authenticated, service_role;

-- Promotion flyers share the public storefront-media bucket, but only an
-- owner with the entitled plan may write inside a tenant's promotions folder.
DROP POLICY IF EXISTS storefront_media_promotion_owner_insert ON storage.objects;
CREATE POLICY storefront_media_promotion_owner_insert
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] = 'promotions'
    AND public.current_user_owns_tenant(
      ((storage.foldername(name))[1])::UUID
    )
    AND public.tenant_plan_has_feature(
      ((storage.foldername(name))[1])::UUID,
      'storefront_promotions'
    )
  );

DROP POLICY IF EXISTS storefront_media_promotion_owner_update ON storage.objects;
CREATE POLICY storefront_media_promotion_owner_update
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] = 'promotions'
    AND public.current_user_owns_tenant(
      ((storage.foldername(name))[1])::UUID
    )
    AND public.tenant_plan_has_feature(
      ((storage.foldername(name))[1])::UUID,
      'storefront_promotions'
    )
  )
  WITH CHECK (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] = 'promotions'
    AND public.current_user_owns_tenant(
      ((storage.foldername(name))[1])::UUID
    )
    AND public.tenant_plan_has_feature(
      ((storage.foldername(name))[1])::UUID,
      'storefront_promotions'
    )
  );

DROP POLICY IF EXISTS storefront_media_promotion_owner_delete ON storage.objects;
CREATE POLICY storefront_media_promotion_owner_delete
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'storefront-media'
    AND (storage.foldername(name))[2] = 'promotions'
    AND public.current_user_owns_tenant(
      ((storage.foldername(name))[1])::UUID
    )
  );

NOTIFY pgrst, 'reload schema';
COMMIT;
