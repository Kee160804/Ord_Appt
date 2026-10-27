BEGIN;

-- Receipt review, audit history, order payment state, inventory state, and the
-- payment-confirmed email trigger must commit or roll back together.
CREATE OR REPLACE FUNCTION public.review_customer_payment_submission(
  p_tenant_id UUID,
  p_submission_id UUID,
  p_actor_id UUID,
  p_action TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS TABLE (
  submission_status TEXT,
  payment_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_submission public.customer_payment_submissions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_action TEXT := UPPER(COALESCE(p_action, ''));
  v_next_status TEXT;
  v_amount_paid NUMERIC(12,2);
  v_payment_status TEXT;
  v_payment_minutes INTEGER;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  IF v_action NOT IN ('VERIFIED', 'REJECTED', 'RESUBMISSION_REQUESTED') THEN
    RAISE EXCEPTION 'Invalid payment review action.' USING ERRCODE = '22023';
  END IF;
  IF v_action <> 'VERIFIED'
    AND NULLIF(BTRIM(COALESCE(p_comment, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'Provide a reason for the customer.' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_submission
  FROM public.customer_payment_submissions
  WHERE id = p_submission_id
    AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND OR v_submission.status <> 'AWAITING_VERIFICATION' THEN
    RAISE EXCEPTION 'This submission was already processed.'
      USING ERRCODE = 'P0001';
  END IF;

  v_next_status := v_action;
  UPDATE public.customer_payment_submissions
  SET
    status = v_next_status,
    rejection_reason =
      CASE WHEN v_action = 'VERIFIED' THEN NULL ELSE BTRIM(p_comment) END,
    verified_by = p_actor_id,
    verified_at = NOW(),
    updated_at = NOW()
  WHERE id = v_submission.id;

  INSERT INTO public.payment_verification_events (
    tenant_id,
    submission_id,
    actor_id,
    action,
    comment
  ) VALUES (
    p_tenant_id,
    v_submission.id,
    p_actor_id,
    v_action,
    COALESCE(
      NULLIF(BTRIM(COALESCE(p_comment, '')), ''),
      'Funds confirmed in the business bank account.'
    )
  );

  IF v_submission.order_id IS NOT NULL THEN
    SELECT *
    INTO v_order
    FROM public.orders
    WHERE id = v_submission.order_id
      AND tenant_id = p_tenant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The related order no longer exists.';
    END IF;

    IF v_action = 'VERIFIED' THEN
      SELECT COALESCE(SUM(submitted_amount), 0)
      INTO v_amount_paid
      FROM public.customer_payment_submissions
      WHERE order_id = v_order.id
        AND tenant_id = p_tenant_id
        AND status = 'VERIFIED';
      v_payment_status :=
        CASE
          WHEN v_amount_paid >= COALESCE(v_order.total, 0) THEN 'PAID'
          ELSE 'PARTIALLY_PAID'
        END;
      UPDATE public.orders
      SET
        amount_paid = v_amount_paid,
        payment_status = v_payment_status,
        inventory_reservation_status =
          CASE
            WHEN v_payment_status = 'PAID' THEN 'PURCHASED'
            ELSE inventory_reservation_status
          END,
        inventory_reservation_expires_at =
          CASE
            WHEN v_payment_status = 'PAID' THEN NULL
            ELSE inventory_reservation_expires_at
          END
      WHERE id = v_order.id
        AND tenant_id = p_tenant_id;
    ELSIF v_action = 'REJECTED' THEN
      v_payment_status := 'REJECTED';
      UPDATE public.orders
      SET
        status = 'CANCELLED',
        payment_status = v_payment_status,
        fulfillment_status = 'CANCELLED',
        inventory_reservation_status = 'CANCELLED',
        inventory_reservation_expires_at = NULL
      WHERE id = v_order.id
        AND tenant_id = p_tenant_id;
    ELSE
      SELECT COALESCE(settings.payment_window_minutes, 30)
      INTO v_payment_minutes
      FROM public.business_fulfillment_settings AS settings
      WHERE settings.tenant_id = p_tenant_id;
      v_payment_minutes := GREATEST(
        5,
        LEAST(1440, COALESCE(v_payment_minutes, 30))
      );
      v_payment_status := 'AWAITING_PAYMENT';
      UPDATE public.orders
      SET
        payment_status = v_payment_status,
        inventory_reservation_status = 'AWAITING_PAYMENT',
        inventory_reservation_expires_at =
          NOW() + MAKE_INTERVAL(mins => v_payment_minutes)
      WHERE id = v_order.id
        AND tenant_id = p_tenant_id;
    END IF;
  ELSE
    SELECT *
    INTO v_appointment
    FROM public.appointments
    WHERE id = v_submission.appointment_id
      AND tenant_id = p_tenant_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The related appointment no longer exists.';
    END IF;

    IF v_action = 'VERIFIED' THEN
      SELECT COALESCE(SUM(submitted_amount), 0)
      INTO v_amount_paid
      FROM public.customer_payment_submissions
      WHERE appointment_id = v_appointment.id
        AND tenant_id = p_tenant_id
        AND status = 'VERIFIED';
      v_payment_status :=
        CASE
          WHEN v_amount_paid >= COALESCE(v_appointment.total, 0) THEN 'PAID'
          ELSE 'PARTIALLY_PAID'
        END;
      UPDATE public.appointments
      SET
        amount_paid = v_amount_paid,
        outstanding_balance =
          GREATEST(0, COALESCE(v_appointment.total, 0) - v_amount_paid),
        payment_status = v_payment_status
      WHERE id = v_appointment.id
        AND tenant_id = p_tenant_id;
    ELSE
      v_payment_status :=
        CASE
          WHEN v_action = 'RESUBMISSION_REQUESTED' THEN 'AWAITING_PAYMENT'
          ELSE 'REJECTED'
        END;
      UPDATE public.appointments
      SET payment_status = v_payment_status
      WHERE id = v_appointment.id
        AND tenant_id = p_tenant_id;
    END IF;
  END IF;

  RETURN QUERY SELECT v_next_status, v_payment_status;
END;
$$;

REVOKE ALL ON FUNCTION public.review_customer_payment_submission(
  UUID, UUID, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_customer_payment_submission(
  UUID, UUID, UUID, TEXT, TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
