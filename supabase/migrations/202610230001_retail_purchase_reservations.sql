BEGIN;

-- Customer-to-business retail reservations. This remains completely separate
-- from YuhBusiness subscription billing and the platform payment ledger.
ALTER TABLE public.business_fulfillment_settings
  ADD COLUMN IF NOT EXISTS retail_reservations_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS email_verification_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS payment_window_minutes INTEGER NOT NULL DEFAULT 30;

ALTER TABLE public.business_fulfillment_settings
  DROP CONSTRAINT IF EXISTS business_fulfillment_email_verification_minutes_check,
  ADD CONSTRAINT business_fulfillment_email_verification_minutes_check
    CHECK (email_verification_minutes BETWEEN 2 AND 30),
  DROP CONSTRAINT IF EXISTS business_fulfillment_payment_window_minutes_check,
  ADD CONSTRAINT business_fulfillment_payment_window_minutes_check
    CHECK (payment_window_minutes BETWEEN 5 AND 1440);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_verification_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS customer_verification_code_hash TEXT,
  ADD COLUMN IF NOT EXISTS customer_verification_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_verification_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inventory_reservation_status TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS inventory_reservation_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_inventory_reservation_expiry_idx
  ON public.orders (tenant_id, inventory_reservation_expires_at)
  WHERE inventory_reservation_status IN ('AWAITING_EMAIL_VERIFICATION','AWAITING_PAYMENT');

-- Keep variant restoration paired with the shared order-status trigger, which
-- already restores ordinary product stock. Each path runs exactly once on the
-- transition to CANCELLED.
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
      WHERE id = item_row.variant_id AND tenant_id = NEW.tenant_id;

      INSERT INTO public.inventory_adjustments (
        tenant_id, product_id, variant_id, quantity_delta, reason, order_id
      ) VALUES (
        NEW.tenant_id, item_row.product_id, item_row.variant_id,
        item_row.quantity, 'RESERVATION_RELEASED', NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_retail_purchase_reservations(
  p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.orders
  SET status = 'CANCELLED',
      payment_status = 'CANCELED',
      fulfillment_status = 'CANCELLED',
      customer_verification_status = CASE
        WHEN customer_verification_status = 'PENDING' THEN 'EXPIRED'
        ELSE customer_verification_status
      END,
      inventory_reservation_status = 'EXPIRED',
      inventory_reservation_expires_at = NULL
  WHERE tenant_id = p_tenant_id
    AND inventory_reservation_status IN ('AWAITING_EMAIL_VERIFICATION','AWAITING_PAYMENT')
    AND inventory_reservation_expires_at <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_retail_purchase_reservations(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_retail_purchase_reservations(UUID)
  TO service_role;

-- Creates the order, reserves stock, installs the secure guest token, and
-- queues the one-time email in one transaction. A queue failure rolls the
-- entire order and inventory deduction back, preventing stranded reservations.
CREATE OR REPLACE FUNCTION public.create_public_retail_reservation_v3(
  p_tenant_id UUID,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_items JSONB,
  p_notes TEXT DEFAULT NULL,
  p_promotion_code TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'pay_later',
  p_tracking_token_hash TEXT DEFAULT NULL,
  p_tracking_token_expires_at TIMESTAMPTZ DEFAULT NULL,
  p_verification_code_hash TEXT DEFAULT NULL,
  p_verification_code TEXT DEFAULT NULL
)
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  total NUMERIC,
  payment_status TEXT,
  payment_reference TEXT,
  verification_required BOOLEAN,
  verification_expires_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_created RECORD;
  v_enabled BOOLEAN := TRUE;
  v_verify_minutes INTEGER := 5;
  v_payment_minutes INTEGER := 30;
  v_requires_verification BOOLEAN;
  v_verify_expiry TIMESTAMPTZ;
BEGIN
  PERFORM public.expire_retail_purchase_reservations(p_tenant_id);

  SELECT
    COALESCE((SELECT settings.retail_reservations_enabled FROM public.business_fulfillment_settings settings WHERE settings.tenant_id = p_tenant_id), TRUE),
    COALESCE((SELECT settings.email_verification_minutes FROM public.business_fulfillment_settings settings WHERE settings.tenant_id = p_tenant_id), 30),
    COALESCE((SELECT settings.payment_window_minutes FROM public.business_fulfillment_settings settings WHERE settings.tenant_id = p_tenant_id), 30)
  INTO v_enabled, v_verify_minutes, v_payment_minutes;

  v_requires_verification :=
    v_enabled AND LOWER(COALESCE(p_payment_method, '')) = 'bank_transfer';

  IF v_requires_verification AND (
    NULLIF(p_tracking_token_hash, '') IS NULL OR
    NULLIF(p_verification_code_hash, '') IS NULL OR
    NULLIF(p_verification_code, '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Secure email verification could not be prepared.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_created
  FROM public.create_public_retail_order_v2(
    p_tenant_id, p_customer_name, p_customer_email, p_customer_phone,
    p_items, p_notes, p_promotion_code, 'pay_later'
  );

  v_verify_expiry := CASE
    WHEN v_requires_verification THEN NOW() + MAKE_INTERVAL(mins => v_verify_minutes)
    ELSE NULL
  END;

  UPDATE public.orders
  SET payment_method = LOWER(COALESCE(p_payment_method, 'pay_later')),
      payment_status = CASE
        WHEN LOWER(COALESCE(p_payment_method, '')) IN ('bank_transfer','external_link')
          THEN 'AWAITING_PAYMENT'
        ELSE payment_status
      END,
      fulfillment_status = 'AWAITING_ACCEPTANCE',
      tracking_token_hash = p_tracking_token_hash,
      tracking_token_expires_at = p_tracking_token_expires_at,
      customer_verification_status = CASE WHEN v_requires_verification THEN 'PENDING' ELSE 'NOT_REQUIRED' END,
      customer_verification_code_hash = CASE WHEN v_requires_verification THEN p_verification_code_hash ELSE NULL END,
      customer_verification_expires_at = v_verify_expiry,
      customer_verification_attempts = 0,
      inventory_reservation_status = CASE
        WHEN v_requires_verification THEN 'AWAITING_EMAIL_VERIFICATION'
        ELSE 'NONE'
      END,
      inventory_reservation_expires_at = v_verify_expiry
  WHERE id = v_created.order_id AND tenant_id = p_tenant_id;

  IF v_requires_verification THEN
    INSERT INTO public.order_email_deliveries (
      tenant_id, order_id, event_type, recipient_email, recipient_name,
      subject, payload, status, attempt_count, created_at, updated_at
    ) VALUES (
      p_tenant_id, v_created.order_id, 'ORDER_EMAIL_VERIFICATION',
      LOWER(BTRIM(p_customer_email)), BTRIM(p_customer_name),
      'Verify your retail reservation',
      JSONB_BUILD_OBJECT(
        'order_number', v_created.order_number,
        'verification_code', p_verification_code,
        'verification_expires_at', v_verify_expiry,
        'payment_window_minutes', v_payment_minutes,
        'total', v_created.total
      ),
      'PENDING', 0, NOW(), NOW()
    )
    ON CONFLICT (order_id, event_type) DO UPDATE
    SET recipient_email = EXCLUDED.recipient_email,
        recipient_name = EXCLUDED.recipient_name,
        subject = EXCLUDED.subject,
        payload = EXCLUDED.payload,
        status = 'PENDING', attempt_count = 0, last_error = NULL,
        processing_started_at = NULL, sent_at = NULL, updated_at = NOW();
  END IF;

  RETURN QUERY SELECT
    v_created.order_id::UUID,
    v_created.order_number::TEXT,
    v_created.total::NUMERIC,
    CASE
      WHEN LOWER(COALESCE(p_payment_method, '')) IN ('bank_transfer','external_link')
        THEN 'AWAITING_PAYMENT'
      ELSE v_created.payment_status
    END::TEXT,
    v_created.payment_reference::TEXT,
    v_requires_verification,
    v_verify_expiry,
    v_verify_expiry;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_retail_reservation_v3(
  UUID,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_retail_reservation_v3(
  UUID,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TEXT,TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.verify_public_retail_reservation(
  p_tenant_id UUID,
  p_order_id UUID,
  p_customer_email TEXT,
  p_tracking_token_hash TEXT,
  p_verification_code_hash TEXT
)
RETURNS TABLE (verified BOOLEAN, reservation_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_payment_minutes INTEGER := 30;
  v_reservation_expiry TIMESTAMPTZ;
BEGIN
  PERFORM public.expire_retail_purchase_reservations(p_tenant_id);

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND
     OR LOWER(COALESCE(v_order.customer_email, '')) <> LOWER(BTRIM(COALESCE(p_customer_email, '')))
     OR v_order.tracking_token_hash IS DISTINCT FROM p_tracking_token_hash THEN
    RAISE EXCEPTION 'The verification request is invalid.' USING ERRCODE = 'P0001';
  END IF;

  IF v_order.customer_verification_status = 'VERIFIED' THEN
    RETURN QUERY SELECT TRUE, v_order.inventory_reservation_expires_at;
    RETURN;
  END IF;

  IF v_order.customer_verification_status <> 'PENDING'
     OR v_order.customer_verification_expires_at <= NOW()
     OR v_order.inventory_reservation_status <> 'AWAITING_EMAIL_VERIFICATION' THEN
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_order.customer_verification_code_hash IS DISTINCT FROM p_verification_code_hash THEN
    UPDATE public.orders
    SET customer_verification_attempts = customer_verification_attempts + 1
    WHERE id = p_order_id;

    IF v_order.customer_verification_attempts + 1 >= 5 THEN
      UPDATE public.orders
      SET status = 'CANCELLED', payment_status = 'CANCELED',
          fulfillment_status = 'CANCELLED', customer_verification_status = 'EXPIRED',
          inventory_reservation_status = 'EXPIRED', inventory_reservation_expires_at = NULL
      WHERE id = p_order_id;
    END IF;
    RETURN QUERY SELECT FALSE, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT COALESCE(
    (SELECT settings.payment_window_minutes FROM public.business_fulfillment_settings settings WHERE settings.tenant_id = p_tenant_id),
    30
  ) INTO v_payment_minutes;
  v_reservation_expiry := NOW() + MAKE_INTERVAL(mins => v_payment_minutes);

  UPDATE public.orders
  SET customer_verification_status = 'VERIFIED',
      customer_verification_code_hash = NULL,
      customer_verified_at = NOW(),
      inventory_reservation_status = 'AWAITING_PAYMENT',
      inventory_reservation_expires_at = v_reservation_expiry
  WHERE id = p_order_id;

  RETURN QUERY SELECT TRUE, v_reservation_expiry;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_public_retail_reservation(UUID,UUID,TEXT,TEXT,TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_public_retail_reservation(UUID,UUID,TEXT,TEXT,TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.list_public_retail_reservations(p_tenant_id UUID)
RETURNS TABLE (product_id UUID, reservation_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.expire_retail_purchase_reservations(p_tenant_id);
  RETURN QUERY
  SELECT DISTINCT item.product_id, MAX(ord.inventory_reservation_expires_at)
  FROM public.orders ord
  JOIN public.order_items item ON item.order_id = ord.id AND item.tenant_id = ord.tenant_id
  JOIN public.products product ON product.id = item.product_id AND product.tenant_id = ord.tenant_id
  WHERE ord.tenant_id = p_tenant_id
    AND ord.inventory_reservation_status IN ('AWAITING_EMAIL_VERIFICATION','AWAITING_PAYMENT','RECEIPT_AWAITING_VERIFICATION')
    AND (
      (item.variant_id IS NULL
        AND COALESCE(product.track_inventory, product.stock IS NOT NULL)
        AND product.stock = 0)
      OR
      (item.variant_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.product_variants variant
        WHERE variant.product_id = item.product_id
          AND variant.tenant_id = ord.tenant_id
          AND variant.available = TRUE
          AND variant.stock > 0
      ))
    )
  GROUP BY item.product_id;
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_retail_reservations(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_retail_reservations(UUID)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
