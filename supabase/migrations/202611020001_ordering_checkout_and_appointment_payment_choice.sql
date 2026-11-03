BEGIN;

-- The checkout RPC returns a column named order_id. The unqualified
-- ON CONFLICT (order_id, event_type) target is therefore ambiguous inside
-- PL/pgSQL and rolls back an otherwise valid ordering checkout. Tell PL/pgSQL
-- to prefer table columns when a variable and column share the same name.
-- This works whether email-event uniqueness is backed by a constraint or a
-- standalone unique index.
DO $migration$
DECLARE
  v_signature REGPROCEDURE :=
    'public.create_customer_business_order(uuid,uuid,jsonb)'::REGPROCEDURE;
  v_definition TEXT;
  v_patched_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(v_signature) INTO v_definition;

  IF POSITION('#variable_conflict use_column' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  v_patched_definition := REGEXP_REPLACE(
    v_definition,
    E'(AS \\$function\\$\\s*)DECLARE',
    E'\\1#variable_conflict use_column\\nDECLARE',
    'i'
  );

  IF v_patched_definition = v_definition
    OR POSITION(
      '#variable_conflict use_column' IN v_patched_definition
    ) = 0
  THEN
    RAISE EXCEPTION
      'Unable to patch the ordering checkout function definition.';
  END IF;

  EXECUTE v_patched_definition;
END;
$migration$;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_selection TEXT NOT NULL DEFAULT 'DEPOSIT';

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS appointments_payment_selection_check;
ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_payment_selection_check
  CHECK (payment_selection IN ('DEPOSIT', 'FULL'));

-- Add a payment-choice-aware overload while preserving the existing booking
-- RPC and its established email behavior.
CREATE OR REPLACE FUNCTION public.create_public_appointment_with_customer_payment(
  p_tenant_id UUID,
  p_service_id UUID,
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_notes TEXT,
  p_staff_id UUID,
  p_promotion_code TEXT,
  p_payment_method TEXT,
  p_payment_option TEXT
)
RETURNS TABLE(
  appointment_id UUID,
  appointment_number TEXT,
  payment_status TEXT,
  payment_reference TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_created RECORD;
  v_selection TEXT := UPPER(BTRIM(COALESCE(p_payment_option, '')));
  v_deposit NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_expected NUMERIC(12,2);
BEGIN
  IF v_selection NOT IN ('DEPOSIT', 'FULL') THEN
    RAISE EXCEPTION 'Choose whether to pay the deposit or the full amount.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_created
  FROM public.create_public_appointment_with_customer_payment(
    p_tenant_id,
    p_service_id,
    p_appointment_date,
    p_appointment_time,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_notes,
    p_staff_id,
    p_promotion_code,
    p_payment_method
  );

  SELECT
    COALESCE(appointment.deposit_required, 0),
    COALESCE(appointment.total, 0)
  INTO v_deposit, v_total
  FROM public.appointments AS appointment
  WHERE appointment.id = v_created.appointment_id
    AND appointment.tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_deposit <= 0 THEN
    v_selection := 'FULL';
  END IF;
  v_expected := CASE
    WHEN v_selection = 'FULL' THEN v_total
    ELSE LEAST(v_deposit, v_total)
  END;

  UPDATE public.appointments AS appointment
  SET
    payment_selection = v_selection,
    outstanding_balance = GREATEST(
      v_expected - COALESCE(appointment.amount_paid, 0),
      0
    )
  WHERE appointment.id = v_created.appointment_id
    AND appointment.tenant_id = p_tenant_id;

  RETURN QUERY SELECT
    v_created.appointment_id::UUID,
    v_created.appointment_number::TEXT,
    v_created.payment_status::TEXT,
    v_created.payment_reference::TEXT,
    v_created.created_at::TIMESTAMPTZ;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_appointment_with_customer_payment(
  UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_appointment_with_customer_payment(
  UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT
) TO service_role;

-- In-person confirmation must record the amount the customer selected, not
-- always the deposit first.
CREATE OR REPLACE FUNCTION public.record_appointment_in_person_payment(
  p_tenant_id UUID,
  p_appointment_id UUID,
  p_actor_id UUID
)
RETURNS TABLE(amount_paid NUMERIC, outstanding_balance NUMERIC, payment_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
#variable_conflict use_column
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_amount NUMERIC(12,2);
  v_paid NUMERIC(12,2);
  v_outstanding NUMERIC(12,2);
  v_status TEXT;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_appointment
  FROM public.appointments AS appointment
  WHERE appointment.id = p_appointment_id
    AND appointment.tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found.';
  END IF;
  IF UPPER(COALESCE(v_appointment.status, ''))
      IN ('CANCELLED', 'CANCELED', 'COMPLETED')
    OR UPPER(COALESCE(v_appointment.payment_status, ''))
      IN ('PAID', 'REFUNDED')
  THEN
    RAISE EXCEPTION 'This appointment does not accept another payment.';
  END IF;

  v_amount := CASE
    WHEN v_appointment.payment_selection = 'FULL'
      THEN GREATEST(
        COALESCE(v_appointment.total, 0) -
          COALESCE(v_appointment.amount_paid, 0),
        0
      )
    WHEN COALESCE(v_appointment.deposit_required, 0) >
        COALESCE(v_appointment.amount_paid, 0)
      THEN v_appointment.deposit_required -
        COALESCE(v_appointment.amount_paid, 0)
    ELSE GREATEST(
      COALESCE(v_appointment.total, 0) -
        COALESCE(v_appointment.amount_paid, 0),
      0
    )
  END;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'No payment is due.';
  END IF;

  v_paid := LEAST(
    COALESCE(v_appointment.total, 0),
    COALESCE(v_appointment.amount_paid, 0) + v_amount
  );
  v_outstanding := GREATEST(
    COALESCE(v_appointment.total, 0) - v_paid,
    0
  );
  v_status := CASE
    WHEN v_outstanding = 0 THEN 'PAID'
    ELSE 'PARTIALLY_PAID'
  END;

  INSERT INTO public.appointment_manual_payment_events(
    tenant_id,
    appointment_id,
    actor_id,
    amount
  ) VALUES (
    p_tenant_id,
    p_appointment_id,
    p_actor_id,
    v_amount
  );

  UPDATE public.appointments AS appointment
  SET
    amount_paid = v_paid,
    deposit_paid = LEAST(
      v_paid,
      COALESCE(appointment.deposit_required, 0)
    ),
    outstanding_balance = v_outstanding,
    payment_status = v_status,
    payment_reservation_expires_at = NULL
  WHERE appointment.id = p_appointment_id
    AND appointment.tenant_id = p_tenant_id;

  RETURN QUERY SELECT v_paid, v_outstanding, v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.record_appointment_in_person_payment(
  UUID, UUID, UUID
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_appointment_in_person_payment(
  UUID, UUID, UUID
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
