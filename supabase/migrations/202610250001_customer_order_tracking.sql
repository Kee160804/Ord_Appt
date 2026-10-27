BEGIN;

-- Tracking access is independent of checkout tokens and reservation lifetimes.
CREATE TABLE IF NOT EXISTS public.order_tracking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT,
  code_expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS order_tracking_sessions_order_idx
  ON public.order_tracking_sessions(order_id, created_at DESC);
ALTER TABLE public.order_tracking_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_tracking_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.order_tracking_sessions TO service_role;

CREATE OR REPLACE FUNCTION public.request_order_tracking_code(
  p_tenant_id UUID, p_order_id UUID, p_token_hash TEXT, p_code_hash TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_id UUID;
BEGIN
  -- Serialize requests for this order, including requests from different IPs.
  SELECT * INTO v_order FROM public.orders
    WHERE id = p_order_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_order.customer_email, '') = '' THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM public.order_tracking_sessions
      WHERE order_id = p_order_id AND created_at > NOW() - INTERVAL '60 seconds')
    OR (SELECT COUNT(*) FROM public.order_tracking_sessions
      WHERE order_id = p_order_id AND created_at > NOW() - INTERVAL '15 minutes') >= 5
  THEN RETURN NULL; END IF;

  -- Resending replaces only pending challenges, never a verified session.
  UPDATE public.order_tracking_sessions SET code_hash = NULL
    WHERE order_id = p_order_id AND verified_at IS NULL;
  INSERT INTO public.order_tracking_sessions
    (tenant_id, order_id, customer_email, token_hash, code_hash, code_expires_at)
  VALUES (p_tenant_id, p_order_id, LOWER(v_order.customer_email), p_token_hash,
    p_code_hash, NOW() + INTERVAL '10 minutes') RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_order_tracking_code(
  p_tenant_id UUID, p_token_hash TEXT, p_code_hash TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.order_tracking_sessions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_minutes INTEGER;
BEGIN
  -- Use the same lock order as requests (order, then session).
  SELECT * INTO v_session FROM public.order_tracking_sessions
    WHERE tenant_id = p_tenant_id AND token_hash = p_token_hash;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = v_session.order_id
    AND tenant_id = p_tenant_id FOR UPDATE;
  SELECT * INTO v_session FROM public.order_tracking_sessions
    WHERE id = v_session.id FOR UPDATE;
  IF v_session.expires_at <= NOW()
    OR LOWER(COALESCE(v_order.customer_email, '')) <> v_session.customer_email
  THEN RETURN FALSE; END IF;
  IF v_session.verified_at IS NOT NULL THEN RETURN TRUE; END IF;
  IF v_session.code_hash IS NULL OR v_session.code_expires_at <= NOW()
    OR v_session.attempts >= 5 THEN RETURN FALSE; END IF;
  IF v_session.code_hash IS DISTINCT FROM p_code_hash THEN
    UPDATE public.order_tracking_sessions SET attempts = attempts + 1 WHERE id = v_session.id;
    RETURN FALSE;
  END IF;
  UPDATE public.order_tracking_sessions SET verified_at = NOW(), code_hash = NULL
    WHERE id = v_session.id;

  -- Email ownership also satisfies an active checkout verification step.
  -- Never revive an expired reservation or reset a paid/completed order.
  IF v_order.customer_verification_status = 'PENDING'
    AND v_order.inventory_reservation_status = 'AWAITING_EMAIL_VERIFICATION'
    AND v_order.inventory_reservation_expires_at > NOW()
    AND UPPER(v_order.status) <> 'CANCELLED'
  THEN
    SELECT COALESCE((SELECT payment_window_minutes FROM public.business_fulfillment_settings
      WHERE tenant_id = p_tenant_id), 30) INTO v_minutes;
    UPDATE public.orders SET customer_verification_status = 'VERIFIED',
      customer_verification_code_hash = NULL, customer_verified_at = NOW(),
      inventory_reservation_status = 'AWAITING_PAYMENT',
      inventory_reservation_expires_at = NOW() + MAKE_INTERVAL(mins => v_minutes)
    WHERE id = v_order.id;
  END IF;
  RETURN TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.request_order_tracking_code(UUID,UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_order_tracking_code(UUID,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_order_tracking_code(UUID,UUID,TEXT,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_order_tracking_code(UUID,TEXT,TEXT) TO service_role;

-- Atomically record the receipt and payment status for verified tracking users.
CREATE OR REPLACE FUNCTION public.submit_tracked_order_receipt(
  p_tenant_id UUID, p_order_id UUID, p_token_hash TEXT, p_submission_id UUID,
  p_amount NUMERIC, p_payment_date DATE, p_receipt_path TEXT, p_mime_type TEXT,
  p_reference TEXT, p_notes TEXT
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_business_type TEXT;
BEGIN
  SELECT * INTO v_order FROM public.orders
    WHERE tenant_id = p_tenant_id AND id = p_order_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.order_tracking_sessions WHERE tenant_id = p_tenant_id
      AND order_id = p_order_id AND token_hash = p_token_hash AND verified_at IS NOT NULL
      AND expires_at > NOW() AND customer_email = LOWER(v_order.customer_email)
  ) THEN RAISE EXCEPTION 'Verify your email to upload a receipt.'; END IF;
  SELECT business_type INTO v_business_type FROM public.tenants
    WHERE id = p_tenant_id AND is_active AND UPPER(status) = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Storefront unavailable.'; END IF;
  IF UPPER(v_order.status) IN ('CANCELLED','CANCELED')
    OR UPPER(v_order.payment_status) IN ('PAID','REFUNDED','CANCELED','CANCELLED')
    OR v_order.inventory_reservation_status IN ('EXPIRED','CANCELLED')
    OR v_order.inventory_reservation_expires_at <= NOW()
  THEN RAISE EXCEPTION 'This order no longer accepts receipts.'; END IF;
  IF COALESCE(v_order.payment_method, 'pay_later') <> 'bank_transfer' AND NOT (
    COALESCE(v_order.payment_method, 'pay_later') = 'pay_later' AND EXISTS (
      SELECT 1 FROM public.business_payment_methods WHERE tenant_id = p_tenant_id
        AND method = 'bank_transfer' AND enabled AND modules @> ARRAY[
          CASE WHEN v_business_type = 'retail' THEN 'retail' ELSE 'ordering' END]
    )
  ) THEN RAISE EXCEPTION 'Bank transfers are not available for this order.'; END IF;
  IF EXISTS (SELECT 1 FROM public.customer_payment_submissions
    WHERE order_id = p_order_id AND status IN ('AWAITING_VERIFICATION','VERIFIED'))
  THEN RAISE EXCEPTION 'A receipt has already been submitted for this order.'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_payment_date IS NULL
    OR p_receipt_path NOT LIKE p_tenant_id::TEXT || '/order/' || p_order_id::TEXT || '/%'
    OR p_mime_type NOT IN ('image/jpeg','image/png','application/pdf')
  THEN RAISE EXCEPTION 'Invalid receipt details.'; END IF;
  INSERT INTO public.customer_payment_submissions
    (id,tenant_id,order_id,customer_name,customer_email,expected_amount,submitted_amount,
     payment_date,transaction_reference,receipt_path,receipt_mime_type,notes)
  VALUES (p_submission_id,p_tenant_id,p_order_id,COALESCE(v_order.customer_name,'Customer'),
    v_order.customer_email,v_order.total,p_amount,p_payment_date,NULLIF(p_reference,''),
    p_receipt_path,p_mime_type,NULLIF(p_notes,''));
  INSERT INTO public.payment_verification_events (tenant_id,submission_id,action,comment)
    VALUES (p_tenant_id,p_submission_id,'SUBMITTED','Receipt submitted by verified customer.');
  UPDATE public.orders SET payment_status = 'AWAITING_VERIFICATION', payment_method = 'bank_transfer',
    inventory_reservation_status = CASE WHEN inventory_reservation_status = 'NONE' THEN 'NONE' ELSE 'RECEIPT_AWAITING_VERIFICATION' END,
    inventory_reservation_expires_at = NULL
  WHERE id = p_order_id;
  RETURN p_submission_id;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_tracked_order_receipt(UUID,UUID,TEXT,UUID,NUMERIC,DATE,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tracked_order_receipt(UUID,UUID,TEXT,UUID,NUMERIC,DATE,TEXT,TEXT,TEXT,TEXT) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
