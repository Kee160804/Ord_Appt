BEGIN;

-- Storefront visitors may discover only currently redeemable promotions. The
-- function deliberately omits redemption counts and owner-only metadata.
CREATE OR REPLACE FUNCTION public.list_public_storefront_promotions(
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
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
        AND public.growth_tools_subscription_allows_access(tenant.id)
    )
  ORDER BY promotion.created_at DESC
  LIMIT 25;
$$;

REVOKE ALL ON FUNCTION public.list_public_storefront_promotions(UUID)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_storefront_promotions(UUID)
  TO anon, authenticated, service_role;

-- Retail checkout previously validated a code in the browser but discarded it
-- when the final order was created. This wrapper keeps order creation, the
-- automatic threshold discount, promo redemption, inventory, and mock payment
-- in one database transaction so a failed promotion rolls everything back.
CREATE OR REPLACE FUNCTION public.create_public_retail_order_v2(
  p_tenant_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL,
  p_promotion_code TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'pay_later'
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  total NUMERIC,
  payment_status TEXT,
  payment_reference TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created RECORD;
  v_payment TEXT := LOWER(COALESCE(p_payment_method, 'pay_later'));
  v_tax_rate NUMERIC(5,2);
  v_discount_enabled BOOLEAN;
  v_discount_threshold NUMERIC(12,2);
  v_discount_rate NUMERIC(5,2);
  v_tax NUMERIC(12,2);
  v_automatic_discount NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_reference TEXT;
BEGIN
  IF v_payment NOT IN ('pay_later', 'mock_card') THEN
    RAISE EXCEPTION 'Choose a valid payment method.' USING ERRCODE = '22023';
  END IF;

  -- Always create the base order unpaid. Payment is recorded only after every
  -- discount has been calculated successfully.
  SELECT * INTO v_created
  FROM public.create_public_retail_order(
    p_tenant_id,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_items,
    p_notes,
    'pay_later'
  );

  SELECT
    COALESCE((SELECT settings.tax_rate FROM public.business_settings settings WHERE settings.tenant_id = p_tenant_id), 10),
    COALESCE((SELECT settings.discount_enabled FROM public.business_settings settings WHERE settings.tenant_id = p_tenant_id), FALSE),
    COALESCE((SELECT settings.discount_threshold FROM public.business_settings settings WHERE settings.tenant_id = p_tenant_id), 100),
    COALESCE((SELECT settings.discount_rate FROM public.business_settings settings WHERE settings.tenant_id = p_tenant_id), 5)
  INTO v_tax_rate, v_discount_enabled, v_discount_threshold, v_discount_rate;

  v_tax := ROUND(v_created.total * (v_tax_rate / 100), 2);
  v_automatic_discount := CASE
    WHEN v_discount_enabled AND v_created.total >= v_discount_threshold
      THEN ROUND(v_created.total * (v_discount_rate / 100), 2)
    ELSE 0
  END;
  v_total := GREATEST(v_created.total + v_tax - v_automatic_discount, 0);

  UPDATE public.orders
  SET tax_amount = v_tax,
      discount_amount = v_automatic_discount,
      total = v_total
  WHERE id = v_created.order_id AND tenant_id = p_tenant_id;

  IF NULLIF(BTRIM(COALESCE(p_promotion_code, '')), '') IS NOT NULL THEN
    v_total := public.apply_public_order_promotion(
      p_tenant_id,
      v_created.order_id,
      p_promotion_code
    );
  END IF;

  IF v_payment = 'mock_card' THEN
    v_reference := 'MOCK-' || UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT, '-', ''), 16));
    INSERT INTO public.payment_transactions (
      tenant_id,
      order_id,
      provider_reference,
      kind,
      amount,
      status,
      idempotency_key,
      paid_at,
      metadata
    ) VALUES (
      p_tenant_id,
      v_created.order_id,
      v_reference,
      'ORDER',
      v_total,
      'SUCCEEDED',
      'mock-retail-order-v2/' || v_created.order_id,
      NOW(),
      JSONB_BUILD_OBJECT('notice', 'Simulated payment; no real money processed')
    );
    UPDATE public.orders
    SET payment_status = 'PAID'
    WHERE id = v_created.order_id AND tenant_id = p_tenant_id;
  END IF;

  RETURN QUERY
  SELECT
    v_created.order_id::UUID,
    v_created.order_number::TEXT,
    v_total,
    CASE WHEN v_payment = 'mock_card' THEN 'PAID' ELSE 'UNPAID' END::TEXT,
    v_reference;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_retail_order_v2(
  UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_retail_order_v2(
  UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
