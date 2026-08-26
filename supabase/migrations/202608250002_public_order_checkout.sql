BEGIN;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS addons JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.create_public_order(
  p_tenant_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_order_type TEXT,
  p_items JSONB,
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
  v_total NUMERIC(12,2);
  v_order_id UUID;
  v_order_number TEXT;
  v_customer_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
BEGIN
  p_customer_name := BTRIM(COALESCE(p_customer_name, ''));
  p_customer_phone := BTRIM(COALESCE(p_customer_phone, ''));
  p_order_type := LOWER(BTRIM(COALESCE(p_order_type, '')));
  p_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  IF LENGTH(p_customer_name) < 2 OR LENGTH(p_customer_name) > 120 THEN
    RAISE EXCEPTION 'Enter a valid customer name.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(p_customer_phone) < 7 OR LENGTH(p_customer_phone) > 40 THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE = '22023';
  END IF;
  IF p_order_type NOT IN ('dine_in', 'pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose a valid order type.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'An order cannot contain more than 100 line items.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) item
    GROUP BY item->>'product_id'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Each product may appear only once per order.' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NOT NULL AND LENGTH(p_notes) > 1000 THEN
    RAISE EXCEPTION 'Order notes cannot exceed 1000 characters.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = p_tenant_id
    AND is_active = TRUE
    AND status = 'ACTIVE'
    AND LOWER(business_type) = 'ordering';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This storefront is not accepting orders.' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::INTEGER;
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
    IF v_product.stock IS NOT NULL AND v_product.stock < v_quantity THEN
      RAISE EXCEPTION '% has insufficient stock.', v_product.name
        USING ERRCODE = 'P0001';
    END IF;

    v_unit_total := v_product.price;
    v_addons := COALESCE(v_item->'addons', '[]'::jsonb);
    IF jsonb_typeof(v_addons) <> 'array' THEN
      RAISE EXCEPTION 'Invalid product add-ons.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_addons) selected
      GROUP BY selected->>'id'
      HAVING COUNT(*) > 1
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
        WHERE option->>'id' = v_addon->>'id'
        LIMIT 1
      ), 0);
    END LOOP;
    v_subtotal := v_subtotal + (v_unit_total * v_quantity);
  END LOOP;

  v_tax := ROUND(v_subtotal * 0.10, 2);
  v_discount := CASE WHEN v_subtotal > 100 THEN ROUND(v_subtotal * 0.05, 2) ELSE 0 END;
  v_total := v_subtotal + v_tax - v_discount;

  v_first_name := SPLIT_PART(p_customer_name, ' ', 1);
  v_last_name := NULLIF(BTRIM(SUBSTRING(p_customer_name FROM LENGTH(v_first_name) + 1)), '');
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE tenant_id = p_tenant_id AND phone = p_customer_phone
  ORDER BY created_at LIMIT 1;
  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (tenant_id, first_name, last_name, phone, is_active)
    VALUES (p_tenant_id, v_first_name, COALESCE(v_last_name, ''), p_customer_phone, TRUE)
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET first_name = v_first_name, last_name = COALESCE(v_last_name, ''), is_active = TRUE, updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  v_order_number := UPPER(COALESCE(NULLIF(LEFT(
    REGEXP_REPLACE(v_tenant.business_name, '[^A-Za-z0-9]', '', 'g'), 2
  ), ''), 'OR')) || '-' || UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT, '-', ''), 12));
  INSERT INTO public.orders (
    tenant_id, customer_id, order_number, customer_name, customer_phone,
    status, payment_status, total, notes
  ) VALUES (
    p_tenant_id, v_customer_id, v_order_number, p_customer_name, p_customer_phone,
    'PENDING', 'UNPAID', v_total,
    CONCAT_WS(E'\n', 'Order type: ' || p_order_type, p_notes)
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::UUID AND tenant_id = p_tenant_id FOR UPDATE;
    v_quantity := (v_item->>'quantity')::INTEGER;
    v_addons := COALESCE(v_item->'addons', '[]'::jsonb);
    v_unit_total := v_product.price + COALESCE((
      SELECT SUM((option->>'price')::NUMERIC)
      FROM jsonb_array_elements(v_addons) selected
      JOIN LATERAL jsonb_array_elements(COALESCE(v_product.addons, '[]'::jsonb)) option
        ON option->>'id' = selected->>'id'
    ), 0);
    INSERT INTO public.order_items (tenant_id, order_id, product_id, product_name, quantity, unit_price, subtotal, addons)
    VALUES (p_tenant_id, v_order_id, v_product.id, v_product.name, v_quantity, v_unit_total, v_unit_total * v_quantity, v_addons);
    UPDATE public.products
    SET stock = CASE
      WHEN stock IS NULL THEN NULL
      ELSE GREATEST(stock - v_quantity, 0)
    END
    WHERE id = v_product.id;
  END LOOP;

  RETURN QUERY SELECT v_order_id, v_order_number, v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order(UUID, TEXT, TEXT, TEXT, JSONB, TEXT) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
