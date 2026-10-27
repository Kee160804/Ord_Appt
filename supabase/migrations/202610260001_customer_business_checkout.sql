BEGIN;

-- One customer checkout creates one order even when the browser retries after
-- a slow or interrupted response.
CREATE TABLE IF NOT EXISTS public.customer_checkout_requests (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  checkout_id UUID NOT NULL,
  payload_hash TEXT NOT NULL,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, checkout_id)
);

ALTER TABLE public.customer_checkout_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_checkout_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.customer_checkout_requests TO service_role;

CREATE OR REPLACE FUNCTION public.create_customer_business_order(
  p_tenant_id UUID,
  p_checkout_id UUID,
  p_checkout JSONB
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  total NUMERIC,
  payment_status TEXT,
  email_queued BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_settings public.business_settings%ROWTYPE;
  v_fulfillment public.business_fulfillment_settings%ROWTYPE;
  v_request public.customer_checkout_requests%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_created RECORD;
  v_method TEXT := COALESCE(p_checkout->>'p_payment_method', 'pay_later');
  v_type TEXT := COALESCE(p_checkout->>'p_order_type', 'pickup');
  v_module TEXT;
  v_available INTEGER;
  v_method_valid BOOLEAN;
  v_requested TIMESTAMPTZ :=
    NULLIF(p_checkout->>'p_requested_time', '')::TIMESTAMPTZ;
  v_fee NUMERIC := 0;
  v_verify BOOLEAN;
  v_expiry TIMESTAMPTZ;
  v_items JSONB;
BEGIN
  IF p_checkout_id IS NULL OR JSONB_TYPEOF(p_checkout) <> 'object' THEN
    RAISE EXCEPTION 'Invalid checkout request.';
  END IF;

  SELECT *
  INTO v_tenant
  FROM public.tenants
  WHERE id = p_tenant_id
    AND is_active
    AND UPPER(status) = 'ACTIVE';

  IF NOT FOUND
    OR LOWER(v_tenant.business_type) NOT IN ('retail', 'ordering')
    OR NOT public.tenant_subscription_allows_access(p_tenant_id)
  THEN
    RAISE EXCEPTION 'This storefront is not accepting orders.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_tenant_id::TEXT || ':' || p_checkout_id::TEXT,
      0
    )
  );

  SELECT *
  INTO v_request
  FROM public.customer_checkout_requests
  WHERE tenant_id = p_tenant_id
    AND checkout_id = p_checkout_id;

  IF FOUND THEN
    IF v_request.payload_hash <> MD5(p_checkout::TEXT) THEN
      RAISE EXCEPTION 'This checkout request no longer matches the cart.';
    END IF;

    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = v_request.order_id
      AND tenant_id = p_tenant_id;

    RETURN QUERY
    SELECT
      v_order.id,
      v_order.order_number::TEXT,
      v_order.total::NUMERIC,
      v_order.payment_status::TEXT,
      EXISTS (
        SELECT 1
        FROM public.order_email_deliveries AS delivery
        WHERE delivery.order_id = v_order.id
          AND delivery.event_type = 'ORDER_RECEIVED'
      );
    RETURN;
  END IF;

  SELECT *
  INTO v_settings
  FROM public.business_settings
  WHERE tenant_id = p_tenant_id;

  SELECT *
  INTO v_fulfillment
  FROM public.business_fulfillment_settings
  WHERE tenant_id = p_tenant_id;

  v_module :=
    CASE
      WHEN LOWER(v_tenant.business_type) = 'retail' THEN 'retail'
      ELSE 'ordering'
    END;

  IF NOT COALESCE(v_settings.ordering_enabled, TRUE)
    OR COALESCE(v_settings.ordering_paused, FALSE)
  THEN
    RAISE EXCEPTION 'Online ordering is temporarily unavailable.';
  END IF;

  IF v_type NOT IN ('dine_in', 'pickup', 'delivery')
    OR NOT (
      v_type = ANY(
        COALESCE(
          v_settings.order_types,
          ARRAY['dine_in', 'pickup', 'delivery']::TEXT[]
        )
      )
    )
    OR (v_module = 'retail' AND v_type = 'dine_in')
    OR (
      v_type = 'pickup'
      AND NOT COALESCE(v_fulfillment.pickup_enabled, TRUE)
    )
    OR (
      v_type = 'delivery'
      AND NOT (
        COALESCE(v_fulfillment.local_delivery_enabled, FALSE)
        OR COALESCE(v_fulfillment.nationwide_delivery_enabled, FALSE)
      )
    )
  THEN
    RAISE EXCEPTION 'This fulfillment option is unavailable.';
  END IF;

  IF v_type = 'pickup'
    AND (
      v_requested IS NULL
      OR v_requested < NOW() + MAKE_INTERVAL(
        mins => COALESCE(v_settings.preparation_minutes, 30)
      )
    )
  THEN
    RAISE EXCEPTION 'Choose a pickup time allowing for preparation.';
  END IF;

  IF v_type = 'dine_in'
    AND COALESCE(BTRIM(p_checkout->>'p_table_number'), '') = ''
  THEN
    RAISE EXCEPTION 'A table number is required.';
  END IF;

  IF v_type = 'delivery' THEN
    IF COALESCE(BTRIM(p_checkout->>'p_delivery_address'), '') = ''
      OR COALESCE(BTRIM(p_checkout->>'p_delivery_area'), '') = ''
    THEN
      RAISE EXCEPTION 'Delivery address and area are required.';
    END IF;

    IF CARDINALITY(
      COALESCE(v_settings.delivery_areas, ARRAY[]::TEXT[])
    ) > 0
      AND NOT (
        (p_checkout->>'p_delivery_area') = ANY(v_settings.delivery_areas)
      )
    THEN
      RAISE EXCEPTION 'This delivery area is unavailable.';
    END IF;

    v_fee := COALESCE(v_settings.delivery_fee, 0);
  END IF;

  SELECT
    COUNT(*),
    COALESCE(BOOL_OR(method = v_method), FALSE)
  INTO v_available, v_method_valid
  FROM public.business_payment_methods
  WHERE tenant_id = p_tenant_id
    AND enabled
    AND modules @> ARRAY[v_module]
    AND method <> 'payment_at_appointment'
    AND (method <> 'cash_on_delivery' OR v_type = 'delivery')
    AND (method <> 'payment_on_pickup' OR v_type = 'pickup');

  IF NOT (
    (v_method = 'pay_later' AND v_available = 0)
    OR v_method_valid
  ) THEN
    RAISE EXCEPTION 'Choose a valid business payment method.';
  END IF;

  IF v_method = 'bank_transfer'
    AND NOT EXISTS (
      SELECT 1
      FROM public.business_bank_accounts
      WHERE tenant_id = p_tenant_id
        AND is_active
    )
  THEN
    RAISE EXCEPTION 'Bank transfers are currently unavailable.';
  END IF;

  IF v_method = 'external_link'
    AND NOT EXISTS (
      SELECT 1
      FROM public.business_payment_methods
      WHERE tenant_id = p_tenant_id
        AND method = v_method
        AND enabled
        AND external_url ~ '^https://'
    )
  THEN
    RAISE EXCEPTION 'The business payment link is unavailable.';
  END IF;

  -- Existing catalog RPCs remain authoritative for price and stock.
  IF v_module = 'retail' THEN
    SELECT *
    INTO v_created
    FROM public.create_public_retail_order_v2(
      p_tenant_id,
      p_checkout->>'p_customer_name',
      p_checkout->>'p_customer_email',
      p_checkout->>'p_customer_phone',
      p_checkout->'p_items',
      p_checkout->>'p_notes',
      NULL,
      'pay_later'
    );

    UPDATE public.orders AS orders
    SET
      order_type = v_type,
      requested_time = v_requested,
      delivery_address =
        CASE
          WHEN v_type = 'delivery'
            THEN p_checkout->>'p_delivery_address'
          ELSE NULL
        END,
      delivery_area =
        CASE
          WHEN v_type = 'delivery'
            THEN p_checkout->>'p_delivery_area'
          ELSE NULL
        END,
      delivery_instructions =
        CASE
          WHEN v_type = 'delivery'
            THEN p_checkout->>'p_delivery_instructions'
          ELSE NULL
        END,
      delivery_fee = v_fee,
      total = orders.total + v_fee
    WHERE orders.id = v_created.order_id
      AND orders.tenant_id = p_tenant_id;

    IF NULLIF(p_checkout->>'p_promotion_code', '') IS NOT NULL THEN
      PERFORM public.apply_public_order_promotion(
        p_tenant_id,
        v_created.order_id,
        p_checkout->>'p_promotion_code'
      );
    END IF;
  ELSE
    SELECT *
    INTO v_created
    FROM public.create_public_order_v3(
      p_tenant_id,
      p_checkout->>'p_customer_name',
      p_checkout->>'p_customer_email',
      p_checkout->>'p_customer_phone',
      v_type,
      p_checkout->'p_items',
      v_requested,
      p_checkout->>'p_delivery_address',
      p_checkout->>'p_delivery_area',
      p_checkout->>'p_delivery_instructions',
      p_checkout->>'p_table_number',
      p_checkout->>'p_notes',
      p_checkout->>'p_promotion_code',
      'pay_later'
    );
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = v_created.order_id
    AND tenant_id = p_tenant_id;

  IF v_order.subtotal < COALESCE(v_settings.minimum_order, 0) THEN
    RAISE EXCEPTION 'Your cart is below the minimum order amount.';
  END IF;

  v_verify :=
    v_module = 'retail'
    AND v_method = 'bank_transfer'
    AND COALESCE(v_fulfillment.retail_reservations_enabled, TRUE);
  v_expiry :=
    CASE
      WHEN v_verify THEN NOW() + MAKE_INTERVAL(
        mins => COALESCE(v_fulfillment.email_verification_minutes, 30)
      )
      ELSE NULL
    END;

  UPDATE public.orders AS orders
  SET
    payment_method = v_method,
    payment_status =
      CASE
        WHEN v_method IN ('bank_transfer', 'external_link')
          THEN 'AWAITING_PAYMENT'
        ELSE 'UNPAID'
      END,
    customer_verification_status =
      CASE WHEN v_verify THEN 'PENDING' ELSE 'NOT_REQUIRED' END,
    inventory_reservation_status =
      CASE WHEN v_verify THEN 'AWAITING_EMAIL_VERIFICATION' ELSE 'NONE' END,
    inventory_reservation_expires_at = v_expiry,
    customer_verification_expires_at = v_expiry
  WHERE orders.id = v_order.id;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = v_created.order_id
    AND tenant_id = p_tenant_id;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'name', item.product_name,
        'quantity', item.quantity,
        'unit_price', item.unit_price,
        'subtotal', item.subtotal
      ) ORDER BY item.created_at
    ),
    '[]'::JSONB
  )
  INTO v_items
  FROM public.order_items AS item
  WHERE item.order_id = v_order.id
    AND item.tenant_id = p_tenant_id;

  INSERT INTO public.order_email_deliveries (
    tenant_id,
    order_id,
    event_type,
    recipient_email,
    recipient_name,
    subject,
    payload
  ) VALUES (
    p_tenant_id,
    v_order.id,
    'ORDER_RECEIVED',
    v_order.customer_email,
    v_order.customer_name,
    'We received order ' || v_order.order_number,
    JSONB_BUILD_OBJECT(
      'business_name', v_tenant.business_name,
      'storefront_slug', v_tenant.slug,
      'order_number', v_order.order_number,
      'created_at', v_order.created_at,
      'order_type', v_type,
      'requested_time', v_order.requested_time,
      'delivery_address', v_order.delivery_address,
      'delivery_area', v_order.delivery_area,
      'payment_status', v_order.payment_status,
      'payment_method', v_method,
      'subtotal', v_order.subtotal,
      'tax_amount', v_order.tax_amount,
      'delivery_fee', v_order.delivery_fee,
      'total', v_order.total,
      'items', v_items
    )
  )
  ON CONFLICT (order_id, event_type)
  DO UPDATE SET
    recipient_email = EXCLUDED.recipient_email,
    recipient_name = EXCLUDED.recipient_name,
    subject = EXCLUDED.subject,
    payload = EXCLUDED.payload;

  INSERT INTO public.customer_checkout_requests (
    tenant_id,
    checkout_id,
    payload_hash,
    order_id
  ) VALUES (
    p_tenant_id,
    p_checkout_id,
    MD5(p_checkout::TEXT),
    v_order.id
  );

  RETURN QUERY
  SELECT
    v_order.id,
    v_order.order_number::TEXT,
    v_order.total::NUMERIC,
    v_order.payment_status::TEXT,
    TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.create_customer_business_order(UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_business_order(UUID, UUID, JSONB)
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
