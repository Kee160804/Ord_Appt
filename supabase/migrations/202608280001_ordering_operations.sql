BEGIN;

-- Phase Two is additive. Existing settings and orders receive conservative
-- defaults, while the original create_public_order RPC remains untouched for
-- older storefront deployments.
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS ordering_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ordering_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS order_types TEXT[] NOT NULL DEFAULT ARRAY['dine_in', 'pickup', 'delivery']::TEXT[],
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS discount_threshold NUMERIC(12,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS minimum_order NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_areas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS preparation_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS ordering_open_time TIME,
  ADD COLUMN IF NOT EXISTS ordering_close_time TIME;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.business_settings'::REGCLASS
      AND conname = 'business_settings_ordering_values_check'
  ) THEN
    ALTER TABLE public.business_settings
      ADD CONSTRAINT business_settings_ordering_values_check CHECK (
        tax_rate BETWEEN 0 AND 100
        AND discount_rate BETWEEN 0 AND 100
        AND discount_threshold >= 0
        AND minimum_order >= 0
        AND delivery_fee >= 0
        AND preparation_minutes BETWEEN 5 AND 1440
        AND CARDINALITY(order_types) > 0
        AND order_types <@ ARRAY['dine_in', 'pickup', 'delivery']::TEXT[]
      );
  END IF;
END;
$$;

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

-- Preserve any existing status values while extending common single-column
-- status checks. Installations that use a PostgreSQL enum are extended instead.
DO $$
DECLARE
  v_constraint RECORD;
  v_status_type RECORD;
BEGIN
  SELECT columns.data_type, columns.udt_schema, columns.udt_name
  INTO v_status_type
  FROM information_schema.columns
  WHERE columns.table_schema = 'public'
    AND columns.table_name = 'orders'
    AND columns.column_name = 'status';

  IF v_status_type.data_type = 'USER-DEFINED' THEN
    EXECUTE FORMAT(
      'ALTER TYPE %I.%I ADD VALUE IF NOT EXISTS %L',
      v_status_type.udt_schema,
      v_status_type.udt_name,
      'OUT_FOR_DELIVERY'
    );
  ELSE
    FOR v_constraint IN
      SELECT constraint_row.conname
      FROM pg_constraint constraint_row
      JOIN pg_class table_row ON table_row.oid = constraint_row.conrelid
      JOIN pg_namespace schema_row ON schema_row.oid = table_row.relnamespace
      JOIN pg_attribute attribute_row
        ON attribute_row.attrelid = table_row.oid
       AND attribute_row.attname = 'status'
      WHERE schema_row.nspname = 'public'
        AND table_row.relname = 'orders'
        AND constraint_row.contype = 'c'
        AND ARRAY_LENGTH(constraint_row.conkey, 1) = 1
        AND attribute_row.attnum = ANY(constraint_row.conkey)
    LOOP
      EXECUTE FORMAT('ALTER TABLE public.orders DROP CONSTRAINT %I', v_constraint.conname);
    END LOOP;

    ALTER TABLE public.orders
      ADD CONSTRAINT orders_status_phase_two_check
      CHECK (UPPER(status) IN (
        'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY',
        'DELIVERED', 'COMPLETED', 'CANCELLED'
      ));
  END IF;
END;
$$;

UPDATE public.orders
SET subtotal = total
WHERE subtotal IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN subtotal SET DEFAULT 0,
  ALTER COLUMN subtotal SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON public.order_status_history (order_id, created_at);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_status_history_tenant_select ON public.order_status_history;
CREATE POLICY order_status_history_tenant_select
ON public.order_status_history
FOR SELECT TO authenticated
USING (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS super_admin_all_access ON public.order_status_history;
CREATE POLICY super_admin_all_access
ON public.order_status_history
FOR ALL TO authenticated
USING ((SELECT public.is_super_admin()))
WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS tenant_subscription_access_required ON public.order_status_history;
CREATE POLICY tenant_subscription_access_required
ON public.order_status_history AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.tenant_subscription_allows_access(tenant_id))
WITH CHECK (public.tenant_subscription_allows_access(tenant_id));

REVOKE ALL ON TABLE public.order_status_history FROM anon, authenticated;
GRANT SELECT ON TABLE public.order_status_history TO authenticated;

CREATE OR REPLACE FUNCTION public.track_order_status_and_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND UPPER(COALESCE(OLD.status, '')) = 'CANCELLED'
     AND UPPER(COALESCE(NEW.status, '')) <> 'CANCELLED' THEN
    RAISE EXCEPTION 'A cancelled order cannot be reopened.' USING ERRCODE = '22023';
  END IF;

  IF UPPER(COALESCE(NEW.status, '')) = 'CANCELLED'
     AND (TG_OP = 'INSERT' OR UPPER(COALESCE(OLD.status, '')) <> 'CANCELLED') THEN
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, NOW());
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_guard ON public.orders;
CREATE TRIGGER trg_orders_status_guard
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.track_order_status_and_inventory();

CREATE OR REPLACE FUNCTION public.record_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (
      tenant_id, order_id, previous_status, new_status, note, changed_by
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN UPPER(OLD.status) ELSE NULL END,
      UPPER(NEW.status),
      CASE WHEN UPPER(NEW.status) = 'CANCELLED' THEN NEW.cancellation_reason ELSE NULL END,
      auth.uid()
    );

    IF TG_OP = 'UPDATE'
       AND UPPER(COALESCE(NEW.status, '')) = 'CANCELLED'
       AND UPPER(COALESCE(OLD.status, '')) <> 'CANCELLED' THEN
      UPDATE public.products AS product
      SET stock = product.stock + item.quantity
      FROM public.order_items AS item
      WHERE item.order_id = NEW.id
        AND item.product_id = product.id
        AND product.tenant_id = NEW.tenant_id
        AND COALESCE(product.track_inventory, product.stock IS NOT NULL)
        AND product.stock IS NOT NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_record_order_status_change ON public.orders;
CREATE TRIGGER trg_record_order_status_change
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.record_order_status_change();

-- Canonical Phase Two checkout. Pricing and stock are recalculated and locked
-- in PostgreSQL; browser totals are only a preview.
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
) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.order_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  processing_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, event_type),
  CHECK (event_type IN (
    'ORDER_RECEIVED', 'ORDER_ACCEPTED', 'ORDER_PREPARING', 'ORDER_READY',
    'ORDER_OUT_FOR_DELIVERY', 'ORDER_COMPLETED', 'ORDER_CANCELLED'
  )),
  CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS order_email_delivery_status_idx
  ON public.order_email_deliveries (status, created_at);

DROP TRIGGER IF EXISTS trg_order_email_deliveries_updated_at ON public.order_email_deliveries;
CREATE TRIGGER trg_order_email_deliveries_updated_at
BEFORE UPDATE ON public.order_email_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_email_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_email_deliveries_select_policy ON public.order_email_deliveries;
CREATE POLICY order_email_deliveries_select_policy
ON public.order_email_deliveries FOR SELECT TO authenticated
USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS super_admin_all_access ON public.order_email_deliveries;
CREATE POLICY super_admin_all_access
ON public.order_email_deliveries FOR ALL TO authenticated
USING ((SELECT public.is_super_admin()))
WITH CHECK ((SELECT public.is_super_admin()));
DROP POLICY IF EXISTS tenant_subscription_access_required ON public.order_email_deliveries;
CREATE POLICY tenant_subscription_access_required
ON public.order_email_deliveries AS RESTRICTIVE FOR ALL TO authenticated
USING (public.tenant_subscription_allows_access(tenant_id))
WITH CHECK (public.tenant_subscription_allows_access(tenant_id));
REVOKE ALL ON TABLE public.order_email_deliveries FROM anon, authenticated;
GRANT SELECT ON TABLE public.order_email_deliveries TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_order_status_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_event TEXT;
  v_business_name TEXT;
  v_business_email TEXT;
  v_business_phone TEXT;
  v_subject TEXT;
  v_items JSONB;
BEGIN
  IF NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  v_event := CASE UPPER(NEW.status)
    WHEN 'PENDING' THEN 'ORDER_RECEIVED'
    WHEN 'CONFIRMED' THEN 'ORDER_ACCEPTED'
    WHEN 'PREPARING' THEN 'ORDER_PREPARING'
    WHEN 'READY' THEN 'ORDER_READY'
    WHEN 'OUT_FOR_DELIVERY' THEN 'ORDER_OUT_FOR_DELIVERY'
    WHEN 'DELIVERED' THEN 'ORDER_COMPLETED'
    WHEN 'COMPLETED' THEN 'ORDER_COMPLETED'
    WHEN 'CANCELLED' THEN 'ORDER_CANCELLED'
    ELSE NULL
  END;
  IF v_event IS NULL THEN RETURN NEW; END IF;

  SELECT business_name, email, phone
  INTO v_business_name, v_business_email, v_business_phone
  FROM public.tenants WHERE id = NEW.tenant_id;

  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
    'name', item.product_name,
    'quantity', item.quantity,
    'unit_price', item.unit_price,
    'subtotal', item.subtotal
  ) ORDER BY item.created_at), '[]'::JSONB)
  INTO v_items
  FROM public.order_items item WHERE item.order_id = NEW.id;

  v_business_name := COALESCE(NULLIF(v_business_name, ''), 'Your store');
  v_subject := CASE v_event
    WHEN 'ORDER_RECEIVED' THEN 'We received order ' || NEW.order_number
    WHEN 'ORDER_ACCEPTED' THEN 'Order ' || NEW.order_number || ' was accepted'
    WHEN 'ORDER_PREPARING' THEN 'Order ' || NEW.order_number || ' is being prepared'
    WHEN 'ORDER_READY' THEN 'Order ' || NEW.order_number || ' is ready'
    WHEN 'ORDER_OUT_FOR_DELIVERY' THEN 'Order ' || NEW.order_number || ' is out for delivery'
    WHEN 'ORDER_COMPLETED' THEN 'Order ' || NEW.order_number || ' is complete'
    ELSE 'Order ' || NEW.order_number || ' was cancelled'
  END;

  INSERT INTO public.order_email_deliveries (
    tenant_id, order_id, event_type, recipient_email, recipient_name, subject, payload
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    v_event,
    LOWER(BTRIM(NEW.customer_email)),
    COALESCE(NULLIF(BTRIM(NEW.customer_name), ''), 'Customer'),
    v_subject,
    JSONB_BUILD_OBJECT(
      'business_name', v_business_name,
      'business_email', v_business_email,
      'business_phone', v_business_phone,
      'order_number', NEW.order_number,
      'order_type', NEW.order_type,
      'requested_time', NEW.requested_time,
      'delivery_address', NEW.delivery_address,
      'delivery_area', NEW.delivery_area,
      'table_number', NEW.table_number,
      'subtotal', NEW.subtotal,
      'tax_amount', NEW.tax_amount,
      'discount_amount', NEW.discount_amount,
      'delivery_fee', NEW.delivery_fee,
      'total', NEW.total,
      'cancellation_reason', NEW.cancellation_reason,
      'items', v_items
    )
  ) ON CONFLICT (order_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_status_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_order_status_email ON public.orders;
CREATE CONSTRAINT TRIGGER trg_enqueue_order_status_email
AFTER INSERT OR UPDATE OF status ON public.orders
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_status_email();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'orders'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
