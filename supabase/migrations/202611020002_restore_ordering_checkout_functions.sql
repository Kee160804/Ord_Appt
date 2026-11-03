BEGIN;

-- Ensure fresh deployments have the full order record expected by the
-- restored functions. A separate forward migration repeats this idempotently
-- for databases that already applied this file before the repair was added.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type TEXT NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS requested_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT,
  ADD COLUMN IF NOT EXISTS delivery_area TEXT,
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT,
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Restore the authoritative ordering checkout functions required by
-- create_customer_business_order. Some deployed databases intentionally
-- retained the current checkout wrapper while removing these older function
-- definitions, leaving ordering (but not retail) unable to create an order.
CREATE OR REPLACE FUNCTION public.create_public_order_v2(
  p_tenant_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_order_type TEXT,
  p_items JSONB,
  p_requested_time TIMESTAMPTZ DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,
  p_delivery_area TEXT DEFAULT NULL,
  p_delivery_instructions TEXT DEFAULT NULL,
  p_table_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (order_id UUID, order_number TEXT, total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_item JSONB;
  v_product public.products%ROWTYPE;
  v_addon JSONB;
  v_addons JSONB;
  v_quantity INTEGER;
  v_unit_total NUMERIC(12,2);
  v_subtotal NUMERIC(12,2) := 0;
  v_tax NUMERIC(12,2);
  v_discount NUMERIC(12,2);
  v_delivery_fee NUMERIC(12,2) := 0;
  v_total NUMERIC(12,2);
  v_order_id UUID;
  v_order_number TEXT;
  v_customer_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_ordering_enabled BOOLEAN := TRUE;
  v_ordering_paused BOOLEAN := FALSE;
  v_order_types TEXT[] := ARRAY['dine_in', 'pickup', 'delivery']::TEXT[];
  v_tax_rate NUMERIC(5,2) := 10;
  v_discount_enabled BOOLEAN := TRUE;
  v_discount_threshold NUMERIC(12,2) := 100;
  v_discount_rate NUMERIC(5,2) := 5;
  v_minimum_order NUMERIC(12,2) := 0;
  v_configured_delivery_fee NUMERIC(12,2) := 0;
  v_delivery_areas TEXT[] := ARRAY[]::TEXT[];
  v_open_time TIME;
  v_close_time TIME;
  v_timezone TEXT := 'America/Belize';
  v_local_time TIME;
BEGIN
  p_customer_name := BTRIM(COALESCE(p_customer_name, ''));
  p_customer_email := LOWER(BTRIM(COALESCE(p_customer_email, '')));
  p_customer_phone := BTRIM(COALESCE(p_customer_phone, ''));
  p_order_type := LOWER(BTRIM(COALESCE(p_order_type, '')));
  p_delivery_address := NULLIF(BTRIM(COALESCE(p_delivery_address, '')), '');
  p_delivery_area := NULLIF(BTRIM(COALESCE(p_delivery_area, '')), '');
  p_delivery_instructions := NULLIF(BTRIM(COALESCE(p_delivery_instructions, '')), '');
  p_table_number := NULLIF(BTRIM(COALESCE(p_table_number, '')), '');
  p_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  IF LENGTH(p_customer_name) < 2 OR LENGTH(p_customer_name) > 120 THEN
    RAISE EXCEPTION 'Enter a valid customer name.' USING ERRCODE = '22023';
  END IF;
  IF p_customer_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(p_customer_phone) < 7 OR LENGTH(p_customer_phone) > 40 THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'An order cannot contain more than 100 line items.' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NOT NULL AND LENGTH(p_notes) > 1000 THEN
    RAISE EXCEPTION 'Order notes cannot exceed 1000 characters.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = p_tenant_id
    AND is_active = TRUE
    AND UPPER(status) = 'ACTIVE'
    AND LOWER(business_type) = 'ordering';
  IF NOT FOUND OR NOT public.tenant_subscription_allows_access(p_tenant_id) THEN
    RAISE EXCEPTION 'This storefront is not accepting orders.' USING ERRCODE = 'P0001';
  END IF;

  SELECT
    settings.ordering_enabled,
    settings.ordering_paused,
    settings.order_types,
    settings.tax_rate,
    settings.discount_enabled,
    settings.discount_threshold,
    settings.discount_rate,
    settings.minimum_order,
    settings.delivery_fee,
    settings.delivery_areas,
    settings.ordering_open_time,
    settings.ordering_close_time,
    COALESCE(NULLIF(settings.timezone, ''), 'America/Belize')
  INTO
    v_ordering_enabled, v_ordering_paused, v_order_types, v_tax_rate,
    v_discount_enabled, v_discount_threshold, v_discount_rate, v_minimum_order,
    v_configured_delivery_fee, v_delivery_areas, v_open_time, v_close_time, v_timezone
  FROM public.business_settings settings
  WHERE settings.tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    v_ordering_enabled := TRUE;
    v_ordering_paused := FALSE;
    v_order_types := ARRAY['dine_in', 'pickup', 'delivery']::TEXT[];
    v_tax_rate := 10;
    v_discount_enabled := TRUE;
    v_discount_threshold := 100;
    v_discount_rate := 5;
    v_minimum_order := 0;
    v_configured_delivery_fee := 0;
    v_delivery_areas := ARRAY[]::TEXT[];
    v_open_time := NULL;
    v_close_time := NULL;
    v_timezone := 'America/Belize';
  END IF;

  IF NOT v_ordering_enabled OR v_ordering_paused THEN
    RAISE EXCEPTION 'Online ordering is temporarily unavailable.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT (p_order_type = ANY(v_order_types)) THEN
    RAISE EXCEPTION 'That order type is not available.' USING ERRCODE = '22023';
  END IF;

  v_local_time := (NOW() AT TIME ZONE v_timezone)::TIME;
  IF v_open_time IS NOT NULL AND v_close_time IS NOT NULL AND v_open_time <> v_close_time THEN
    IF (v_open_time < v_close_time AND NOT (v_local_time >= v_open_time AND v_local_time < v_close_time))
       OR (v_open_time > v_close_time AND NOT (v_local_time >= v_open_time OR v_local_time < v_close_time)) THEN
      RAISE EXCEPTION 'Online ordering is currently closed.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF p_order_type = 'pickup' THEN
    IF p_requested_time IS NULL OR p_requested_time < NOW() THEN
      RAISE EXCEPTION 'Choose a future pickup time.' USING ERRCODE = '22023';
    END IF;
    IF p_requested_time > NOW() + INTERVAL '30 days' THEN
      RAISE EXCEPTION 'Pickup time cannot be more than 30 days away.' USING ERRCODE = '22023';
    END IF;
  ELSIF p_order_type = 'delivery' THEN
    IF p_delivery_address IS NULL OR p_delivery_area IS NULL THEN
      RAISE EXCEPTION 'Delivery address and area are required.' USING ERRCODE = '22023';
    END IF;
    IF CARDINALITY(v_delivery_areas) > 0
       AND NOT (p_delivery_area = ANY(v_delivery_areas)) THEN
      RAISE EXCEPTION 'That delivery area is not available.' USING ERRCODE = '22023';
    END IF;
    v_delivery_fee := v_configured_delivery_fee;
  ELSIF p_order_type = 'dine_in' AND p_table_number IS NULL THEN
    RAISE EXCEPTION 'A table number is required for dine-in orders.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) item
    GROUP BY item->>'product_id' HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Each product may appear only once per order.' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_quantity := (v_item->>'quantity')::INTEGER;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Each item must have a valid quantity.' USING ERRCODE = '22023';
    END;
    IF v_quantity IS NULL OR v_quantity < 1 OR v_quantity > 99 THEN
      RAISE EXCEPTION 'Each item quantity must be between 1 and 99.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID
      AND tenant_id = p_tenant_id
      AND available = TRUE
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'One of the selected products is unavailable.' USING ERRCODE = 'P0001';
    END IF;
    IF COALESCE(v_product.track_inventory, v_product.stock IS NOT NULL)
       AND v_product.stock IS NOT NULL
       AND v_product.stock < v_quantity THEN
      RAISE EXCEPTION '% has insufficient stock.', v_product.name USING ERRCODE = 'P0001';
    END IF;

    v_unit_total := v_product.price;
    v_addons := COALESCE(v_item->'addons', '[]'::jsonb);
    IF jsonb_typeof(v_addons) <> 'array' THEN
      RAISE EXCEPTION 'Invalid product add-ons.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_addons) selected
      GROUP BY selected->>'id' HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'The same add-on cannot be selected more than once.' USING ERRCODE = '22023';
    END IF;
    FOR v_addon IN SELECT value FROM jsonb_array_elements(v_addons)
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(v_product.addons, '[]'::jsonb)) option
        WHERE option->>'id' = v_addon->>'id'
      ) THEN
        RAISE EXCEPTION 'One of the selected add-ons is unavailable.' USING ERRCODE = 'P0001';
      END IF;
      v_unit_total := v_unit_total + COALESCE((
        SELECT (option->>'price')::NUMERIC
        FROM jsonb_array_elements(COALESCE(v_product.addons, '[]'::jsonb)) option
        WHERE option->>'id' = v_addon->>'id' LIMIT 1
      ), 0);
    END LOOP;
    v_subtotal := v_subtotal + (v_unit_total * v_quantity);
  END LOOP;

  IF v_subtotal < v_minimum_order THEN
    RAISE EXCEPTION 'The minimum order amount is %.', v_minimum_order USING ERRCODE = '22023';
  END IF;
  v_tax := ROUND(v_subtotal * (v_tax_rate / 100), 2);
  v_discount := CASE
    WHEN v_discount_enabled AND v_subtotal >= v_discount_threshold
      THEN ROUND(v_subtotal * (v_discount_rate / 100), 2)
    ELSE 0
  END;
  v_total := v_subtotal + v_tax - v_discount + v_delivery_fee;

  v_first_name := SPLIT_PART(p_customer_name, ' ', 1);
  v_last_name := NULLIF(BTRIM(SUBSTRING(p_customer_name FROM LENGTH(v_first_name) + 1)), '');
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE tenant_id = p_tenant_id
    AND (LOWER(email) = p_customer_email OR phone = p_customer_phone)
  ORDER BY created_at LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (tenant_id, first_name, last_name, email, phone, is_active)
    VALUES (p_tenant_id, v_first_name, COALESCE(v_last_name, ''), p_customer_email, p_customer_phone, TRUE)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET first_name = v_first_name,
        last_name = COALESCE(v_last_name, ''),
        email = p_customer_email,
        phone = p_customer_phone,
        is_active = TRUE,
        updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  v_order_number := UPPER(COALESCE(NULLIF(LEFT(
    REGEXP_REPLACE(v_tenant.business_name, '[^A-Za-z0-9]', '', 'g'), 2
  ), ''), 'OR')) || '-' || UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT, '-', ''), 12));

  INSERT INTO public.orders (
    tenant_id, customer_id, order_number, customer_name, customer_email,
    customer_phone, status, payment_status, total, notes, order_type,
    requested_time, delivery_address, delivery_area, delivery_instructions,
    table_number, subtotal, tax_amount, discount_amount, delivery_fee
  ) VALUES (
    p_tenant_id, v_customer_id, v_order_number, p_customer_name, p_customer_email,
    p_customer_phone, 'PENDING', 'UNPAID', v_total, p_notes, p_order_type,
    p_requested_time, p_delivery_address, p_delivery_area, p_delivery_instructions,
    p_table_number, v_subtotal, v_tax, v_discount, v_delivery_fee
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product
    FROM public.products
    WHERE id = (v_item->>'product_id')::UUID AND tenant_id = p_tenant_id
    FOR UPDATE;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_addons := COALESCE(v_item->'addons', '[]'::jsonb);
    v_unit_total := v_product.price + COALESCE((
      SELECT SUM((option->>'price')::NUMERIC)
      FROM jsonb_array_elements(v_addons) selected
      JOIN LATERAL jsonb_array_elements(COALESCE(v_product.addons, '[]'::jsonb)) option
        ON option->>'id' = selected->>'id'
    ), 0);
    INSERT INTO public.order_items (
      tenant_id, order_id, product_id, product_name, quantity, unit_price, subtotal, addons
    ) VALUES (
      p_tenant_id, v_order_id, v_product.id, v_product.name, v_quantity,
      v_unit_total, v_unit_total * v_quantity, v_addons
    );
    UPDATE public.products
    SET stock = CASE
      WHEN NOT COALESCE(track_inventory, stock IS NOT NULL) OR stock IS NULL THEN stock
      ELSE stock - v_quantity
    END
    WHERE id = v_product.id;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_order_number, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order_v2(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order_v2(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.create_public_order_v3(
  p_tenant_id UUID,p_customer_name TEXT,p_customer_email TEXT,p_customer_phone TEXT,
  p_order_type TEXT,p_items JSONB,p_requested_time TIMESTAMPTZ DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,p_delivery_area TEXT DEFAULT NULL,
  p_delivery_instructions TEXT DEFAULT NULL,p_table_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,p_promotion_code TEXT DEFAULT NULL,p_payment_method TEXT DEFAULT 'pay_later'
) RETURNS TABLE(order_id UUID,order_number TEXT,total NUMERIC,payment_status TEXT,payment_reference TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_created RECORD; v_total NUMERIC; v_reference TEXT; v_payment TEXT:=LOWER(COALESCE(p_payment_method,'pay_later'));
BEGIN
  IF v_payment NOT IN ('pay_later','mock_card') THEN RAISE EXCEPTION 'Choose a valid payment method.' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_created FROM public.create_public_order_v2(p_tenant_id,p_customer_name,p_customer_email,p_customer_phone,p_order_type,p_items,p_requested_time,p_delivery_address,p_delivery_area,p_delivery_instructions,p_table_number,p_notes);
  v_total:=v_created.total;
  IF NULLIF(BTRIM(COALESCE(p_promotion_code,'')),'') IS NOT NULL THEN
    v_total:=public.apply_public_order_promotion(p_tenant_id,v_created.order_id,p_promotion_code);
  END IF;
  IF v_payment='mock_card' THEN
    v_reference:='MOCK-'||UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT,'-',''),16));
    INSERT INTO public.payment_transactions(tenant_id,order_id,provider_reference,kind,amount,status,idempotency_key,paid_at,metadata)
    VALUES(p_tenant_id,v_created.order_id,v_reference,'ORDER',v_total,'SUCCEEDED','mock-order/'||v_created.order_id,NOW(),JSONB_BUILD_OBJECT('notice','Simulated payment; no real money processed'));
    UPDATE public.orders SET payment_status='PAID' WHERE id=v_created.order_id AND tenant_id=p_tenant_id;
  END IF;
  RETURN QUERY SELECT v_created.order_id::UUID,v_created.order_number::TEXT,v_total,
    CASE WHEN v_payment='mock_card' THEN 'PAID' ELSE 'UNPAID' END::TEXT,v_reference;
END; $$;
REVOKE ALL ON FUNCTION public.create_public_order_v3(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order_v3(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;

