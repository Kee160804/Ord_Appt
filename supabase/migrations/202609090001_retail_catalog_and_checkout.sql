BEGIN;

-- Retail extends the shared product catalog with independently stocked variants.
CREATE TABLE IF NOT EXISTS public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}'::JSONB,
  price NUMERIC(12,2),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, sku),
  UNIQUE (id, product_id)
);

CREATE INDEX IF NOT EXISTS product_variants_product_idx
  ON public.product_variants (tenant_id, product_id, available);

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id UUID;

ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;
ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_variant_id_fkey
  FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
  quantity_delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_adjustments_product_idx
  ON public.inventory_adjustments (tenant_id, product_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.restore_retail_variant_inventory_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  item_row RECORD;
BEGIN
  IF UPPER(COALESCE(NEW.status, '')) = 'CANCELLED'
     AND UPPER(COALESCE(OLD.status, '')) <> 'CANCELLED' THEN
    FOR item_row IN
      SELECT product_id, variant_id, quantity
      FROM public.order_items
      WHERE order_id = NEW.id
        AND tenant_id = NEW.tenant_id
        AND variant_id IS NOT NULL
    LOOP
      UPDATE public.product_variants
      SET stock = stock + item_row.quantity, updated_at = NOW()
      WHERE id = item_row.variant_id
        AND tenant_id = NEW.tenant_id;
      INSERT INTO public.inventory_adjustments (
        tenant_id, product_id, variant_id, quantity_delta, reason, order_id
      ) VALUES (
        NEW.tenant_id, item_row.product_id, item_row.variant_id,
        item_row.quantity, 'ORDER_CANCELLED', NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restore_retail_variant_inventory ON public.orders;
CREATE TRIGGER trg_restore_retail_variant_inventory
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.restore_retail_variant_inventory_on_cancel();

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_variants_public_select ON public.product_variants;
CREATE POLICY product_variants_public_select
  ON public.product_variants FOR SELECT TO anon, authenticated
  USING (
    available = TRUE
    AND EXISTS (
      SELECT 1 FROM public.tenants tenant
      WHERE tenant.id = product_variants.tenant_id
        AND tenant.is_active = TRUE
        AND UPPER(tenant.status) = 'ACTIVE'
    )
  );

DROP POLICY IF EXISTS product_variants_member_select ON public.product_variants;
CREATE POLICY product_variants_member_select
  ON public.product_variants FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS product_variants_member_write ON public.product_variants;
CREATE POLICY product_variants_member_write
  ON public.product_variants FOR ALL TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS inventory_adjustments_member_select ON public.inventory_adjustments;
CREATE POLICY inventory_adjustments_member_select
  ON public.inventory_adjustments FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

REVOKE ALL ON public.product_variants, public.inventory_adjustments FROM anon;
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT SELECT ON public.inventory_adjustments TO authenticated;

-- Retail checkout uses the same tenant/customer/order tables and locks each
-- selected variant before pricing or decrementing stock.
CREATE OR REPLACE FUNCTION public.create_public_retail_order(
  p_tenant_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL,
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
SET search_path = public, pg_temp
AS $$
DECLARE
  tenant_row public.tenants%ROWTYPE;
  item JSONB;
  product_row public.products%ROWTYPE;
  variant_row public.product_variants%ROWTYPE;
  quantity_value INTEGER;
  unit_price NUMERIC(12,2);
  subtotal_value NUMERIC(12,2) := 0;
  order_id_value UUID;
  order_number_value TEXT;
  customer_id_value UUID;
  first_name_value TEXT;
  last_name_value TEXT;
  payment_value TEXT := LOWER(COALESCE(p_payment_method, 'pay_later'));
  payment_reference_value TEXT;
BEGIN
  IF payment_value NOT IN ('pay_later', 'mock_card') THEN
    RAISE EXCEPTION 'Choose a valid payment method.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(BTRIM(COALESCE(p_customer_name, ''))) < 2
     OR LENGTH(BTRIM(COALESCE(p_customer_name, ''))) > 120 THEN
    RAISE EXCEPTION 'Enter a valid customer name.' USING ERRCODE = '22023';
  END IF;
  IF LOWER(BTRIM(COALESCE(p_customer_email, ''))) !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(BTRIM(COALESCE(p_customer_phone, ''))) < 7 THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO tenant_row
  FROM public.tenants
  WHERE id = p_tenant_id
    AND is_active = TRUE
    AND UPPER(status) = 'ACTIVE'
    AND LOWER(business_type) = 'retail';
  IF NOT FOUND OR NOT public.tenant_subscription_allows_access(p_tenant_id) THEN
    RAISE EXCEPTION 'This retail storefront is not accepting orders.' USING ERRCODE = 'P0001';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    quantity_value := (item->>'quantity')::INTEGER;
    IF quantity_value IS NULL OR quantity_value < 1 OR quantity_value > 99 THEN
      RAISE EXCEPTION 'Each item quantity must be between 1 and 99.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = (item->>'product_id')::UUID
      AND tenant_id = p_tenant_id
      AND available = TRUE
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'One of the selected products is unavailable.' USING ERRCODE = 'P0001';
    END IF;

    IF NULLIF(item->>'variant_id', '') IS NULL THEN
      IF product_row.stock IS NOT NULL AND product_row.stock < quantity_value THEN
        RAISE EXCEPTION '% has insufficient stock.', product_row.name USING ERRCODE = 'P0001';
      END IF;
      unit_price := product_row.price;
    ELSE
      SELECT * INTO variant_row
      FROM public.product_variants
      WHERE id = (item->>'variant_id')::UUID
        AND tenant_id = p_tenant_id
        AND product_id = product_row.id
        AND available = TRUE
      FOR UPDATE;
      IF NOT FOUND OR variant_row.stock < quantity_value THEN
        RAISE EXCEPTION 'The selected product variant is unavailable.' USING ERRCODE = 'P0001';
      END IF;
      unit_price := COALESCE(variant_row.price, product_row.price);
    END IF;
    subtotal_value := subtotal_value + unit_price * quantity_value;
  END LOOP;

  first_name_value := SPLIT_PART(BTRIM(p_customer_name), ' ', 1);
  last_name_value := NULLIF(BTRIM(SUBSTRING(BTRIM(p_customer_name) FROM LENGTH(first_name_value) + 1)), '');
  SELECT id INTO customer_id_value
  FROM public.customers
  WHERE tenant_id = p_tenant_id AND LOWER(email) = LOWER(BTRIM(p_customer_email))
  ORDER BY created_at LIMIT 1;
  IF customer_id_value IS NULL THEN
    INSERT INTO public.customers (tenant_id, first_name, last_name, email, phone, is_active)
    VALUES (p_tenant_id, first_name_value, COALESCE(last_name_value, ''), LOWER(BTRIM(p_customer_email)), BTRIM(p_customer_phone), TRUE)
    RETURNING id INTO customer_id_value;
  END IF;

  order_number_value := UPPER(COALESCE(NULLIF(LEFT(REGEXP_REPLACE(tenant_row.business_name, '[^A-Za-z0-9]', '', 'g'), 2), ''), 'RT'))
    || '-' || UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT, '-', ''), 12));
  INSERT INTO public.orders (
    tenant_id, customer_id, order_number, customer_name, customer_email, customer_phone,
    status, payment_status, total, subtotal, notes, order_type
  ) VALUES (
    p_tenant_id, customer_id_value, order_number_value, BTRIM(p_customer_name), LOWER(BTRIM(p_customer_email)), BTRIM(p_customer_phone),
    'PENDING', CASE WHEN payment_value = 'mock_card' THEN 'PAID' ELSE 'UNPAID' END,
    subtotal_value, subtotal_value, NULLIF(BTRIM(COALESCE(p_notes, '')), ''), 'pickup'
  ) RETURNING id INTO order_id_value;

  FOR item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    quantity_value := (item->>'quantity')::INTEGER;
    SELECT * INTO product_row FROM public.products WHERE id = (item->>'product_id')::UUID AND tenant_id = p_tenant_id FOR UPDATE;
    IF NULLIF(item->>'variant_id', '') IS NULL THEN
      unit_price := product_row.price;
      UPDATE public.products SET stock = CASE WHEN stock IS NULL THEN NULL ELSE stock - quantity_value END WHERE id = product_row.id;
    ELSE
      SELECT * INTO variant_row FROM public.product_variants WHERE id = (item->>'variant_id')::UUID AND tenant_id = p_tenant_id FOR UPDATE;
      unit_price := COALESCE(variant_row.price, product_row.price);
      UPDATE public.product_variants SET stock = stock - quantity_value, updated_at = NOW() WHERE id = variant_row.id;
    END IF;
    INSERT INTO public.order_items (tenant_id, order_id, product_id, variant_id, product_name, quantity, unit_price, subtotal)
    VALUES (p_tenant_id, order_id_value, product_row.id, NULLIF(item->>'variant_id', '')::UUID, product_row.name, quantity_value, unit_price, unit_price * quantity_value);
    INSERT INTO public.inventory_adjustments (tenant_id, product_id, variant_id, quantity_delta, reason, order_id)
    VALUES (p_tenant_id, product_row.id, NULLIF(item->>'variant_id', '')::UUID, -quantity_value, 'ORDER_CONFIRMED', order_id_value);
  END LOOP;

  IF payment_value = 'mock_card' THEN
    payment_reference_value := 'MOCK-' || UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT, '-', ''), 16));
    INSERT INTO public.payment_transactions (tenant_id, order_id, provider_reference, kind, amount, status, idempotency_key, paid_at, metadata)
    VALUES (p_tenant_id, order_id_value, payment_reference_value, 'ORDER', subtotal_value, 'SUCCEEDED', 'mock-retail-order/' || order_id_value, NOW(), JSONB_BUILD_OBJECT('notice', 'Simulated payment; no real money processed'));
  END IF;

  RETURN QUERY SELECT order_id_value, order_number_value, subtotal_value,
    CASE WHEN payment_value = 'mock_card' THEN 'PAID' ELSE 'UNPAID' END::TEXT,
    payment_reference_value;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_retail_order(UUID,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_retail_order(UUID,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
