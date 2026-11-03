BEGIN;

-- Appointments use the same customer-to-business payment coordination as
-- ordering and retail, while remaining completely separate from platform
-- subscription billing and the Belize Bank merchant gateway.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS appointment_number TEXT,
  -- Some deployed databases predate the appointment payment compatibility
  -- migration. Declare every appointment payment field used below so this
  -- forward migration remains safe and idempotent on those installations.
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS tracking_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reservation_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_tracking_token_hash_idx
  ON public.appointments(tracking_token_hash)
  WHERE tracking_token_hash IS NOT NULL;

UPDATE public.appointments
SET appointment_number = 'AP-' || UPPER(LEFT(REPLACE(id::TEXT, '-', ''), 12))
WHERE NULLIF(BTRIM(COALESCE(appointment_number, '')), '') IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS appointments_tenant_number_idx
  ON public.appointments(tenant_id, appointment_number)
  WHERE appointment_number IS NOT NULL;

-- Public checkout needs only an availability flag. It must never receive bank
-- account credentials before a secure bank-transfer booking is created.
CREATE OR REPLACE FUNCTION public.has_active_business_bank_account(
  p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_bank_accounts account
    JOIN public.tenants tenant ON tenant.id = account.tenant_id
    WHERE account.tenant_id = p_tenant_id
      AND account.is_active = TRUE
      AND tenant.is_active = TRUE
      AND UPPER(COALESCE(tenant.status, '')) = 'ACTIVE'
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_business_bank_account(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_business_bank_account(UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.create_public_appointment_with_customer_payment(
  p_tenant_id UUID,
  p_service_id UUID,
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_notes TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_promotion_code TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'payment_at_appointment'
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
DECLARE
  v_id UUID;
  v_method TEXT := LOWER(BTRIM(COALESCE(p_payment_method, '')));
  v_reference TEXT;
  v_expected NUMERIC(12,2);
  v_deposit NUMERIC(12,2);
  v_payment_minutes INTEGER;
  v_created_at TIMESTAMPTZ;
BEGIN
  IF v_method NOT IN ('bank_transfer', 'payment_at_appointment', 'external_link') THEN
    RAISE EXCEPTION 'Choose a valid business payment method.' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.business_payment_methods method
    WHERE method.tenant_id = p_tenant_id
      AND method.method = v_method
      AND method.enabled = TRUE
      AND method.modules @> ARRAY['appointment']::TEXT[]
  ) AND NOT (
    v_method = 'payment_at_appointment'
    AND NOT EXISTS (
      SELECT 1 FROM public.business_payment_methods method
      WHERE method.tenant_id = p_tenant_id
        AND method.modules @> ARRAY['appointment']::TEXT[]
    )
  ) AND NOT (
    v_method = 'bank_transfer'
    AND EXISTS (
      SELECT 1 FROM public.business_bank_accounts account
      WHERE account.tenant_id = p_tenant_id AND account.is_active = TRUE
    )
  ) THEN
    RAISE EXCEPTION 'That payment method is not available for appointments.' USING ERRCODE = '22023';
  END IF;

  IF v_method = 'bank_transfer' AND NOT EXISTS (
    SELECT 1 FROM public.business_bank_accounts account
    WHERE account.tenant_id = p_tenant_id AND account.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'The business has not configured an active bank account.' USING ERRCODE = '22023';
  END IF;

  IF v_method = 'external_link' AND NOT EXISTS (
    SELECT 1 FROM public.business_payment_methods method
    WHERE method.tenant_id = p_tenant_id
      AND method.method = 'external_link'
      AND method.external_url IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'The business payment link is unavailable.' USING ERRCODE = '22023';
  END IF;

  -- Release first-come appointment holds whose in-person deposit deadline
  -- passed before checking availability for the next customer.
  UPDATE public.appointments appointment
  SET status = 'CANCELLED',
      payment_status = 'CANCELLED',
      cancelled_at = COALESCE(appointment.cancelled_at, NOW())
  WHERE appointment.tenant_id = p_tenant_id
    AND appointment.payment_method = 'payment_at_appointment'
    AND appointment.status = 'PENDING'
    AND appointment.payment_reservation_expires_at IS NOT NULL
    AND appointment.payment_reservation_expires_at <= NOW()
    AND COALESCE(appointment.deposit_paid, 0) < COALESCE(appointment.deposit_required, 0);

  v_id := public.create_public_appointment_with_provider(
    p_tenant_id,
    p_service_id,
    p_appointment_date,
    p_appointment_time,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_notes,
    p_staff_id,
    p_promotion_code
  );

  SELECT
    CASE
      WHEN COALESCE(appointment.deposit_required, 0) > 0
        THEN appointment.deposit_required
      ELSE appointment.total
    END,
    appointment.created_at,
    COALESCE(appointment.deposit_required, 0)
  INTO v_expected, v_created_at, v_deposit
  FROM public.appointments appointment
  WHERE appointment.id = v_id AND appointment.tenant_id = p_tenant_id
  FOR UPDATE;

  SELECT GREATEST(5, LEAST(1440, COALESCE(settings.payment_window_minutes, 30)))
  INTO v_payment_minutes
  FROM public.business_fulfillment_settings settings
  WHERE settings.tenant_id = p_tenant_id;
  v_payment_minutes := COALESCE(v_payment_minutes, 30);
  v_reference := 'AP-' || UPPER(LEFT(REPLACE(v_id::TEXT, '-', ''), 12));

  UPDATE public.appointments
  SET appointment_number = v_reference,
      payment_method = v_method,
      payment_status = CASE
        WHEN v_method IN ('bank_transfer', 'external_link') THEN 'AWAITING_PAYMENT'
        ELSE 'UNPAID'
      END,
      outstanding_balance = GREATEST(COALESCE(v_expected, 0) - COALESCE(amount_paid, 0), 0),
      payment_reservation_expires_at = CASE
        WHEN v_method = 'payment_at_appointment' AND COALESCE(v_deposit, 0) > 0
          THEN NOW() + MAKE_INTERVAL(mins => v_payment_minutes)
        ELSE NULL
      END
  WHERE id = v_id AND tenant_id = p_tenant_id;

  INSERT INTO public.appointment_email_deliveries(
    tenant_id, appointment_id, event_type, recipient_email,
    recipient_name, subject, payload
  )
  SELECT
    appointment.tenant_id, appointment.id, 'APPOINTMENT_RECEIVED', LOWER(appointment.customer_email),
    COALESCE(NULLIF(BTRIM(appointment.customer_name), ''), 'Customer'),
    'Booking request received · ' || COALESCE(tenant.business_name, 'YuhBusiness'),
    JSONB_BUILD_OBJECT(
      'business_name', tenant.business_name,
      'service_name', service.name,
      'starts_at', appointment.starts_at,
      'appointment_number', v_reference,
      'payment_method', v_method,
      'deposit_required', appointment.deposit_required,
      'total', appointment.total,
      'storefront_slug', tenant.slug
    )
  FROM public.appointments appointment
  JOIN public.tenants tenant ON tenant.id = appointment.tenant_id
  LEFT JOIN public.services service ON service.id = appointment.service_id
  WHERE appointment.id = v_id
    AND v_method = 'bank_transfer'
    AND NULLIF(BTRIM(COALESCE(appointment.customer_email, '')), '') IS NOT NULL
  ON CONFLICT ON CONSTRAINT appointment_email_event_unique DO NOTHING;

  RETURN QUERY SELECT
    v_id,
    v_reference,
    CASE
      WHEN v_method IN ('bank_transfer', 'external_link') THEN 'AWAITING_PAYMENT'
      ELSE 'UNPAID'
    END::TEXT,
    v_reference,
    v_created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_appointment_with_customer_payment(
  UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_appointment_with_customer_payment(
  UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) TO service_role;

-- One secure tracking session can belong to either an order or appointment.
ALTER TABLE public.order_tracking_sessions
  ALTER COLUMN order_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE;

ALTER TABLE public.order_tracking_sessions
  DROP CONSTRAINT IF EXISTS order_tracking_sessions_target_check;
ALTER TABLE public.order_tracking_sessions
  ADD CONSTRAINT order_tracking_sessions_target_check
  CHECK ((order_id IS NOT NULL)::INTEGER + (appointment_id IS NOT NULL)::INTEGER = 1);

CREATE INDEX IF NOT EXISTS order_tracking_sessions_appointment_idx
  ON public.order_tracking_sessions(appointment_id, created_at DESC)
  WHERE appointment_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.request_appointment_tracking_code(
  p_tenant_id UUID,
  p_appointment_id UUID,
  p_token_hash TEXT,
  p_code_hash TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_id UUID;
BEGIN
  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND OR COALESCE(v_appointment.customer_email, '') = '' THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.order_tracking_sessions
    WHERE appointment_id = p_appointment_id
      AND created_at > NOW() - INTERVAL '60 seconds'
  ) OR (
    SELECT COUNT(*) FROM public.order_tracking_sessions
    WHERE appointment_id = p_appointment_id
      AND created_at > NOW() - INTERVAL '15 minutes'
  ) >= 5 THEN
    RETURN NULL;
  END IF;

  UPDATE public.order_tracking_sessions
  SET code_hash = NULL
  WHERE appointment_id = p_appointment_id AND verified_at IS NULL;

  INSERT INTO public.order_tracking_sessions(
    tenant_id, appointment_id, customer_email, token_hash, code_hash, code_expires_at
  ) VALUES (
    p_tenant_id, p_appointment_id, LOWER(v_appointment.customer_email),
    p_token_hash, p_code_hash, NOW() + INTERVAL '10 minutes'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_appointment_tracking_code(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_appointment_tracking_code(UUID, UUID, TEXT, TEXT)
  TO service_role;

-- Preserve the existing RPC name so deployed order clients remain compatible,
-- while also verifying appointment sessions stored in the same table.
CREATE OR REPLACE FUNCTION public.verify_order_tracking_code(
  p_tenant_id UUID,
  p_token_hash TEXT,
  p_code_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_session public.order_tracking_sessions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_appointment public.appointments%ROWTYPE;
  v_customer_email TEXT;
  v_minutes INTEGER;
BEGIN
  SELECT * INTO v_session
  FROM public.order_tracking_sessions
  WHERE tenant_id = p_tenant_id AND token_hash = p_token_hash;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF v_session.order_id IS NOT NULL THEN
    SELECT * INTO v_order FROM public.orders
    WHERE id = v_session.order_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    v_customer_email := LOWER(COALESCE(v_order.customer_email, ''));
  ELSE
    SELECT * INTO v_appointment FROM public.appointments
    WHERE id = v_session.appointment_id AND tenant_id = p_tenant_id FOR UPDATE;
    IF NOT FOUND THEN RETURN FALSE; END IF;
    v_customer_email := LOWER(COALESCE(v_appointment.customer_email, ''));
  END IF;

  SELECT * INTO v_session
  FROM public.order_tracking_sessions
  WHERE id = v_session.id FOR UPDATE;
  IF v_session.expires_at <= NOW() OR v_customer_email <> v_session.customer_email THEN
    RETURN FALSE;
  END IF;
  IF v_session.verified_at IS NOT NULL THEN RETURN TRUE; END IF;
  IF v_session.code_hash IS NULL OR v_session.code_expires_at <= NOW()
     OR v_session.attempts >= 5 THEN RETURN FALSE; END IF;
  IF v_session.code_hash IS DISTINCT FROM p_code_hash THEN
    UPDATE public.order_tracking_sessions
    SET attempts = attempts + 1 WHERE id = v_session.id;
    RETURN FALSE;
  END IF;

  UPDATE public.order_tracking_sessions
  SET verified_at = NOW(), code_hash = NULL
  WHERE id = v_session.id;

  IF v_session.order_id IS NOT NULL
     AND v_order.customer_verification_status = 'PENDING'
     AND v_order.inventory_reservation_status = 'AWAITING_EMAIL_VERIFICATION'
     AND v_order.inventory_reservation_expires_at > NOW()
     AND UPPER(v_order.status) <> 'CANCELLED' THEN
    SELECT COALESCE(settings.payment_window_minutes, 30)
    INTO v_minutes
    FROM public.business_fulfillment_settings settings
    WHERE settings.tenant_id = p_tenant_id;
    UPDATE public.orders
    SET customer_verification_status = 'VERIFIED',
        customer_verification_code_hash = NULL,
        customer_verified_at = NOW(),
        inventory_reservation_status = 'AWAITING_PAYMENT',
        inventory_reservation_expires_at = NOW() + MAKE_INTERVAL(mins => COALESCE(v_minutes, 30))
    WHERE id = v_order.id;
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_order_tracking_code(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_order_tracking_code(UUID, TEXT, TEXT)
  TO service_role;

CREATE OR REPLACE FUNCTION public.submit_tracked_appointment_receipt(
  p_tenant_id UUID,
  p_appointment_id UUID,
  p_token_hash TEXT,
  p_submission_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_receipt_path TEXT,
  p_mime_type TEXT,
  p_reference TEXT,
  p_notes TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_expected NUMERIC(12,2);
BEGIN
  SELECT * INTO v_appointment
  FROM public.appointments
  WHERE tenant_id = p_tenant_id AND id = p_appointment_id
  FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.order_tracking_sessions session
    WHERE session.tenant_id = p_tenant_id
      AND session.appointment_id = p_appointment_id
      AND session.token_hash = p_token_hash
      AND session.verified_at IS NOT NULL
      AND session.expires_at > NOW()
      AND session.customer_email = LOWER(v_appointment.customer_email)
  ) THEN
    RAISE EXCEPTION 'Verify your email to upload a receipt.';
  END IF;
  IF UPPER(COALESCE(v_appointment.status, '')) IN ('CANCELLED', 'CANCELED')
     OR UPPER(COALESCE(v_appointment.payment_status, '')) IN ('PAID', 'REFUNDED', 'CANCELLED', 'CANCELED') THEN
    RAISE EXCEPTION 'This appointment no longer accepts receipts.';
  END IF;
  IF v_appointment.payment_method <> 'bank_transfer' THEN
    RAISE EXCEPTION 'Bank transfers are not available for this appointment.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.customer_payment_submissions submission
    WHERE submission.appointment_id = p_appointment_id
      AND submission.status = 'AWAITING_VERIFICATION'
  ) THEN
    RAISE EXCEPTION 'A receipt has already been submitted for this appointment.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_payment_date IS NULL
     OR p_receipt_path NOT LIKE p_tenant_id::TEXT || '/appointment/' || p_appointment_id::TEXT || '/%'
     OR p_mime_type NOT IN ('image/jpeg', 'image/png', 'application/pdf') THEN
    RAISE EXCEPTION 'Invalid receipt details.';
  END IF;

  v_expected := COALESCE(
    NULLIF(v_appointment.outstanding_balance, 0),
    NULLIF(v_appointment.deposit_required, 0),
    v_appointment.total,
    0
  );
  INSERT INTO public.customer_payment_submissions(
    id, tenant_id, appointment_id, customer_name, customer_email,
    expected_amount, submitted_amount, payment_date, transaction_reference,
    receipt_path, receipt_mime_type, notes
  ) VALUES (
    p_submission_id, p_tenant_id, p_appointment_id,
    COALESCE(v_appointment.customer_name, 'Customer'), v_appointment.customer_email,
    v_expected, p_amount, p_payment_date, NULLIF(p_reference, ''),
    p_receipt_path, p_mime_type, NULLIF(p_notes, '')
  );
  INSERT INTO public.payment_verification_events(
    tenant_id, submission_id, action, comment
  ) VALUES (
    p_tenant_id, p_submission_id, 'SUBMITTED',
    'Receipt submitted by verified appointment customer.'
  );
  UPDATE public.appointments
  SET payment_status = 'AWAITING_VERIFICATION',
      payment_reservation_expires_at = NULL
  WHERE id = p_appointment_id;
  RETURN p_submission_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_tracked_appointment_receipt(
  UUID, UUID, TEXT, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_tracked_appointment_receipt(
  UUID, UUID, TEXT, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT
) TO service_role;

-- Appointment confirmations now carry the recoverable appointment reference.
CREATE OR REPLACE FUNCTION public.enqueue_appointment_confirmation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_service_name TEXT;
  v_timezone TEXT;
BEGIN
  IF UPPER(COALESCE(NEW.status, '')) <> 'CONFIRMED'
     OR UPPER(COALESCE(OLD.status, '')) = 'CONFIRMED'
     OR NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = NEW.tenant_id;
  SELECT service.service_name INTO v_service_name
  FROM public.appointment_services service
  WHERE service.appointment_id = NEW.id
  ORDER BY service.created_at LIMIT 1;
  IF v_service_name IS NULL AND NEW.service_id IS NOT NULL THEN
    SELECT service.name INTO v_service_name
    FROM public.services service
    WHERE service.id = NEW.service_id AND service.tenant_id = NEW.tenant_id;
  END IF;
  SELECT COALESCE(NULLIF(settings.timezone, ''), 'America/Belize')
  INTO v_timezone
  FROM public.business_settings settings
  WHERE settings.tenant_id = NEW.tenant_id;

  INSERT INTO public.appointment_email_deliveries(
    tenant_id, appointment_id, event_type, recipient_email,
    recipient_name, subject, payload
  ) VALUES (
    NEW.tenant_id, NEW.id, 'APPOINTMENT_CONFIRMED', LOWER(NEW.customer_email),
    COALESCE(NULLIF(BTRIM(NEW.customer_name), ''), 'Customer'),
    'Your appointment with ' || COALESCE(v_tenant.business_name, 'YuhBusiness') || ' is confirmed',
    JSONB_BUILD_OBJECT(
      'business_name', v_tenant.business_name,
      'business_email', v_tenant.email,
      'business_phone', v_tenant.phone,
      'service_name', COALESCE(v_service_name, 'Appointment'),
      'starts_at', NEW.starts_at,
      'appointment_date', NEW.appointment_date,
      'appointment_time', NEW.appointment_time,
      'timezone', COALESCE(v_timezone, 'America/Belize'),
      'confirmation_code', COALESCE(NEW.appointment_number, UPPER(LEFT(NEW.id::TEXT, 8))),
      'appointment_number', NEW.appointment_number,
      'payment_method', NEW.payment_method,
      'storefront_slug', v_tenant.slug
    )
  ) ON CONFLICT (appointment_id, event_type) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Appointment confirmed but email enqueue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_appointment_confirmation_email()
  FROM PUBLIC, anon, authenticated;

ALTER TABLE public.appointment_email_deliveries
  DROP CONSTRAINT IF EXISTS appointment_email_event_check;
ALTER TABLE public.appointment_email_deliveries
  DROP CONSTRAINT IF EXISTS appointment_email_deliveries_event_type_check;
ALTER TABLE public.appointment_email_deliveries
  ADD CONSTRAINT appointment_email_deliveries_event_type_check
  CHECK (event_type IN ('APPOINTMENT_RECEIVED', 'APPOINTMENT_CONFIRMED', 'APPOINTMENT_PAYMENT_CONFIRMED'));

CREATE OR REPLACE FUNCTION public.enqueue_appointment_payment_confirmed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
BEGIN
  IF UPPER(COALESCE(NEW.payment_status, '')) NOT IN ('PAID', 'PARTIALLY_PAID')
     OR UPPER(COALESCE(OLD.payment_status, '')) IN ('PAID', 'PARTIALLY_PAID')
     OR NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = NEW.tenant_id;
  INSERT INTO public.appointment_email_deliveries(
    tenant_id, appointment_id, event_type, recipient_email,
    recipient_name, subject, payload
  ) VALUES (
    NEW.tenant_id, NEW.id, 'APPOINTMENT_PAYMENT_CONFIRMED', LOWER(NEW.customer_email),
    COALESCE(NULLIF(BTRIM(NEW.customer_name), ''), 'Customer'),
    'Appointment payment confirmed by ' || COALESCE(v_tenant.business_name, 'the business'),
    JSONB_BUILD_OBJECT(
      'business_name', v_tenant.business_name,
      'appointment_number', NEW.appointment_number,
      'payment_status', NEW.payment_status,
      'amount_paid', NEW.amount_paid,
      'outstanding_balance', NEW.outstanding_balance,
      'starts_at', NEW.starts_at,
      'storefront_slug', v_tenant.slug
    )
  ) ON CONFLICT (appointment_id, event_type) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_appointment_payment_confirmed_email()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_appointment_payment_confirmed_email
  ON public.appointments;
CREATE TRIGGER trg_enqueue_appointment_payment_confirmed_email
AFTER UPDATE OF payment_status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_appointment_payment_confirmed_email();

CREATE TABLE IF NOT EXISTS public.appointment_manual_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES auth.users(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_kind TEXT NOT NULL DEFAULT 'IN_PERSON',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS appointment_manual_payment_events_tenant_idx
  ON public.appointment_manual_payment_events(tenant_id, appointment_id, created_at DESC);
ALTER TABLE public.appointment_manual_payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.appointment_manual_payment_events FROM PUBLIC, anon, authenticated;

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
  SELECT * INTO v_appointment FROM public.appointments
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found.'; END IF;
  IF UPPER(COALESCE(v_appointment.status, '')) IN ('CANCELLED', 'CANCELED', 'COMPLETED')
     OR UPPER(COALESCE(v_appointment.payment_status, '')) IN ('PAID', 'REFUNDED') THEN
    RAISE EXCEPTION 'This appointment does not accept another payment.';
  END IF;

  v_amount := CASE
    WHEN COALESCE(v_appointment.deposit_required, 0) > COALESCE(v_appointment.amount_paid, 0)
      THEN v_appointment.deposit_required - COALESCE(v_appointment.amount_paid, 0)
    ELSE GREATEST(COALESCE(v_appointment.total, 0) - COALESCE(v_appointment.amount_paid, 0), 0)
  END;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'No payment is due.'; END IF;
  v_paid := LEAST(COALESCE(v_appointment.total, 0), COALESCE(v_appointment.amount_paid, 0) + v_amount);
  v_outstanding := GREATEST(COALESCE(v_appointment.total, 0) - v_paid, 0);
  v_status := CASE WHEN v_outstanding = 0 THEN 'PAID' ELSE 'PARTIALLY_PAID' END;

  INSERT INTO public.appointment_manual_payment_events(tenant_id, appointment_id, actor_id, amount)
  VALUES (p_tenant_id, p_appointment_id, p_actor_id, v_amount);
  UPDATE public.appointments SET
    amount_paid = v_paid,
    deposit_paid = v_paid,
    outstanding_balance = v_outstanding,
    payment_status = v_status,
    payment_reservation_expires_at = NULL
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id;
  RETURN QUERY SELECT v_paid, v_outstanding, v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.record_appointment_in_person_payment(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_appointment_in_person_payment(UUID, UUID, UUID)
  TO service_role;

CREATE OR REPLACE FUNCTION public.update_tracked_appointment(
  p_tenant_id UUID,
  p_appointment_id UUID,
  p_token_hash TEXT,
  p_action TEXT,
  p_appointment_date DATE DEFAULT NULL,
  p_appointment_time TIME DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_action TEXT := UPPER(BTRIM(COALESCE(p_action, '')));
  v_duration INTEGER;
  v_timezone TEXT;
  v_available BOOLEAN;
  v_start TIMESTAMPTZ;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_appointment FROM public.appointments
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (
    SELECT 1 FROM public.order_tracking_sessions session
    WHERE session.tenant_id = p_tenant_id
      AND session.appointment_id = p_appointment_id
      AND session.token_hash = p_token_hash
      AND session.verified_at IS NOT NULL
      AND session.expires_at > NOW()
      AND session.customer_email = LOWER(v_appointment.customer_email)
  ) THEN
    RAISE EXCEPTION 'Verify your booking before making changes.' USING ERRCODE = '42501';
  END IF;
  IF UPPER(COALESCE(v_appointment.status, '')) IN ('CANCELLED', 'CANCELED', 'COMPLETED', 'NO_SHOW') THEN
    RAISE EXCEPTION 'This booking can no longer be changed.' USING ERRCODE = '22023';
  END IF;

  IF v_action = 'CANCEL' THEN
    UPDATE public.appointments SET status = 'CANCELLED', cancelled_at = NOW()
    WHERE id = p_appointment_id AND tenant_id = p_tenant_id;
    RETURN 'CANCELLED';
  END IF;
  IF v_action <> 'RESCHEDULE' OR p_appointment_date IS NULL OR p_appointment_time IS NULL THEN
    RAISE EXCEPTION 'Choose a valid booking action, date, and time.' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(snapshot.duration_minutes, service.duration_minutes)
  INTO v_duration
  FROM public.services service
  LEFT JOIN public.appointment_services snapshot ON snapshot.appointment_id = v_appointment.id
  WHERE service.id = v_appointment.service_id AND service.tenant_id = p_tenant_id
  ORDER BY snapshot.created_at LIMIT 1;
  v_duration := COALESCE(v_duration, 30);
  IF v_appointment.staff_id IS NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.get_public_appointment_availability(
        p_tenant_id, v_appointment.service_id, p_appointment_date
      ) available WHERE available.appointment_time = p_appointment_time
    ) INTO v_available;
  ELSE
    SELECT EXISTS(
      SELECT 1 FROM public.get_public_provider_availability(
        p_tenant_id, v_appointment.service_id, p_appointment_date, v_appointment.staff_id
      ) available WHERE available.appointment_time = p_appointment_time
    ) INTO v_available;
  END IF;
  IF NOT v_available THEN
    RAISE EXCEPTION 'That appointment time is no longer available.' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(NULLIF(settings.timezone, ''), 'America/Belize') INTO v_timezone
  FROM public.business_settings settings WHERE settings.tenant_id = p_tenant_id;
  v_timezone := COALESCE(v_timezone, 'America/Belize');
  v_start := (p_appointment_date + p_appointment_time) AT TIME ZONE v_timezone;
  UPDATE public.appointments SET
    appointment_date = p_appointment_date,
    appointment_time = p_appointment_time,
    starts_at = v_start,
    ends_at = v_start + MAKE_INTERVAL(mins => v_duration),
    status = 'PENDING',
    cancelled_at = NULL
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id;
  RETURN 'RESCHEDULED';
END;
$$;
REVOKE ALL ON FUNCTION public.update_tracked_appointment(UUID, UUID, TEXT, TEXT, DATE, TIME)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_tracked_appointment(UUID, UUID, TEXT, TEXT, DATE, TIME)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
