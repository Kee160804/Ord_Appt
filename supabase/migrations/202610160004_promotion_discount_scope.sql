-- Make promotion scope explicit so previews and final checkout agree on
-- whether the discount applies to the whole purchase or selected items only.
BEGIN;

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS discount_scope TEXT;

UPDATE public.promotions
SET discount_scope = CASE
  WHEN CARDINALITY(COALESCE(applicable_product_ids, ARRAY[]::UUID[])) > 0
    OR CARDINALITY(COALESCE(applicable_service_ids, ARRAY[]::UUID[])) > 0
    THEN 'ITEMS'
  ELSE 'TOTAL'
END
WHERE discount_scope IS NULL
   OR UPPER(discount_scope) NOT IN ('TOTAL', 'ITEMS');

ALTER TABLE public.promotions
  ALTER COLUMN discount_scope SET DEFAULT 'TOTAL',
  ALTER COLUMN discount_scope SET NOT NULL;

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_discount_scope_check;
ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_discount_scope_check
  CHECK (discount_scope IN ('TOTAL', 'ITEMS'));

ALTER TABLE public.promotions
  DROP CONSTRAINT IF EXISTS promotions_item_scope_selection_check;
ALTER TABLE public.promotions
  ADD CONSTRAINT promotions_item_scope_selection_check
  CHECK (
    discount_scope <> 'ITEMS'
    OR CARDINALITY(COALESCE(applicable_product_ids, ARRAY[]::UUID[])) > 0
    OR CARDINALITY(COALESCE(applicable_service_ids, ARRAY[]::UUID[])) > 0
  );

DROP FUNCTION IF EXISTS public.list_public_storefront_promotions(UUID);
CREATE FUNCTION public.list_public_storefront_promotions(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
  description TEXT,
  flyer_url TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_scope TEXT,
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
    promotion.discount_scope,
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

CREATE OR REPLACE FUNCTION public.calculate_promotion_discount(
  p_tenant_id UUID,
  p_code TEXT,
  p_amount NUMERIC,
  p_product_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_service_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_promo public.promotions;
  v_discount NUMERIC(12,2);
BEGIN
  IF NOT public.tenant_subscription_allows_access(p_tenant_id) THEN
    RAISE EXCEPTION 'This storefront is not accepting requests.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_promo
  FROM public.promotions promotion
  WHERE promotion.tenant_id = p_tenant_id
    AND UPPER(promotion.code) = UPPER(BTRIM(COALESCE(p_code, '')))
    AND promotion.is_active = TRUE
    AND (promotion.starts_at IS NULL OR promotion.starts_at <= NOW())
    AND (promotion.ends_at IS NULL OR promotion.ends_at > NOW())
    AND (
      promotion.usage_limit IS NULL
      OR promotion.usage_count < promotion.usage_limit
    );

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This discount code is invalid or expired.'
      USING ERRCODE = '22023';
  END IF;

  IF v_promo.discount_scope = 'ITEMS'
     AND CARDINALITY(v_promo.applicable_product_ids) > 0
     AND NOT (
       v_promo.applicable_product_ids
       && COALESCE(p_product_ids, ARRAY[]::UUID[])
     ) THEN
    RAISE EXCEPTION 'This code does not apply to the selected products.'
      USING ERRCODE = '22023';
  END IF;

  IF v_promo.discount_scope = 'ITEMS'
     AND CARDINALITY(v_promo.applicable_service_ids) > 0
     AND (
       p_service_id IS NULL
       OR NOT p_service_id = ANY(v_promo.applicable_service_ids)
     ) THEN
    RAISE EXCEPTION 'This code does not apply to the selected service.'
      USING ERRCODE = '22023';
  END IF;

  v_discount := LEAST(
    GREATEST(p_amount, 0),
    CASE
      WHEN v_promo.discount_type = 'PERCENTAGE'
        THEN ROUND(GREATEST(p_amount, 0) * v_promo.discount_value / 100, 2)
      ELSE v_promo.discount_value
    END
  );

  RETURN JSONB_BUILD_OBJECT(
    'promotionId', v_promo.id,
    'code', UPPER(v_promo.code),
    'name', v_promo.name,
    'discountType', v_promo.discount_type,
    'discountValue', v_promo.discount_value,
    'discountScope', v_promo.discount_scope,
    'discountAmount', v_discount,
    'applicableProductIds', v_promo.applicable_product_ids,
    'applicableServiceIds', v_promo.applicable_service_ids
  );
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_promotion_discount(
  UUID, TEXT, NUMERIC, UUID[], UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_promotion_discount(
  UUID, TEXT, NUMERIC, UUID[], UUID
) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_public_order_promotion(
  p_tenant_id UUID,
  p_order_id UUID,
  p_code TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders;
  v_result JSONB;
  v_discount NUMERIC;
  v_ids UUID[];
  v_promo UUID;
  v_applicable UUID[];
  v_scope TEXT;
  v_eligible_amount NUMERIC;
BEGIN
  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR UPPER(v_order.status) <> 'PENDING' THEN
    RAISE EXCEPTION 'Order is not eligible for a discount.'
      USING ERRCODE = '22023';
  END IF;
  IF v_order.promotion_id IS NOT NULL THEN
    RETURN v_order.total;
  END IF;

  SELECT COALESCE(
    ARRAY_AGG(product_id) FILTER (WHERE product_id IS NOT NULL),
    ARRAY[]::UUID[]
  )
  INTO v_ids
  FROM public.order_items
  WHERE order_id = p_order_id AND tenant_id = p_tenant_id;

  SELECT
    promotion.id,
    promotion.applicable_product_ids,
    promotion.discount_scope
  INTO v_promo, v_applicable, v_scope
  FROM public.promotions promotion
  WHERE promotion.tenant_id = p_tenant_id
    AND UPPER(promotion.code) = UPPER(BTRIM(COALESCE(p_code, '')))
  FOR UPDATE;

  IF v_promo IS NULL THEN
    RAISE EXCEPTION 'This discount code is invalid or expired.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(SUM(item.subtotal), 0)
  INTO v_eligible_amount
  FROM public.order_items item
  WHERE item.order_id = p_order_id
    AND item.tenant_id = p_tenant_id
    AND (
      v_scope = 'TOTAL'
      OR item.product_id = ANY(v_applicable)
    );

  IF v_eligible_amount <= 0 THEN
    RAISE EXCEPTION 'This code does not apply to the selected products.'
      USING ERRCODE = '22023';
  END IF;

  v_result := public.calculate_promotion_discount(
    p_tenant_id,
    p_code,
    v_eligible_amount,
    v_ids,
    NULL
  );
  v_discount := (v_result->>'discountAmount')::NUMERIC;
  v_promo := (v_result->>'promotionId')::UUID;

  UPDATE public.orders
  SET promotion_id = v_promo,
      promotion_code = v_result->>'code',
      promotion_discount_amount = v_discount,
      total = GREATEST(total - v_discount, 0)
  WHERE id = p_order_id;

  UPDATE public.promotions
  SET usage_count = usage_count + 1,
      updated_at = NOW()
  WHERE id = v_promo;

  INSERT INTO public.promotion_redemptions (
    tenant_id,
    promotion_id,
    order_id,
    customer_id,
    discount_amount
  ) VALUES (
    p_tenant_id,
    v_promo,
    p_order_id,
    v_order.customer_id,
    v_discount
  );

  RETURN GREATEST(v_order.total - v_discount, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.apply_public_order_promotion(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_public_order_promotion(UUID, UUID, TEXT)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
