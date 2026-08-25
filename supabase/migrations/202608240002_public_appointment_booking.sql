BEGIN;

-- Staff assignment is optional for the owner-only MVP. A staff member can be
-- assigned later without blocking public bookings today.
ALTER TABLE public.appointments
  ALTER COLUMN staff_id DROP NOT NULL;

-- Guard against identical active start times even if two requests arrive at
-- nearly the same instant. The function below also prevents overlapping slots.
CREATE UNIQUE INDEX IF NOT EXISTS appointments_active_start_unique
  ON public.appointments (tenant_id, starts_at)
  WHERE starts_at IS NOT NULL
    AND UPPER(status) NOT IN ('CANCELLED', 'NO_SHOW');

CREATE OR REPLACE FUNCTION public.create_public_appointment(
  p_tenant_id UUID,
  p_service_id UUID,
  p_appointment_date DATE,
  p_appointment_time TIME,
  p_customer_name TEXT,
  p_customer_email TEXT,
  p_customer_phone TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_timezone TEXT;
  v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ;
  v_local_now TIMESTAMP;
  v_day_of_week SMALLINT;
  v_open_time TIME;
  v_close_time TIME;
  v_is_closed BOOLEAN;
  v_customer_id UUID;
  v_appointment_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_deposit NUMERIC(12,2) := 0;
BEGIN
  p_customer_name := BTRIM(COALESCE(p_customer_name, ''));
  p_customer_email := LOWER(BTRIM(COALESCE(p_customer_email, '')));
  p_customer_phone := BTRIM(COALESCE(p_customer_phone, ''));
  p_notes := NULLIF(BTRIM(COALESCE(p_notes, '')), '');

  IF LENGTH(p_customer_name) < 2 OR LENGTH(p_customer_name) > 120 THEN
    RAISE EXCEPTION 'Enter a valid customer name.' USING ERRCODE = '22023';
  END IF;
  IF p_customer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
     OR LENGTH(p_customer_email) > 254 THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(p_customer_phone) < 7 OR LENGTH(p_customer_phone) > 40 THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE = '22023';
  END IF;
  IF p_notes IS NOT NULL AND LENGTH(p_notes) > 1000 THEN
    RAISE EXCEPTION 'Booking notes cannot exceed 1000 characters.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = p_tenant_id
    AND is_active = TRUE
    AND status = 'ACTIVE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This storefront is not accepting bookings.' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_service
  FROM public.services
  WHERE id = p_service_id
    AND tenant_id = p_tenant_id
    AND available = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected service is unavailable.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(NULLIF(timezone, ''), 'America/Belize')
  INTO v_timezone
  FROM public.business_settings
  WHERE tenant_id = p_tenant_id;
  v_timezone := COALESCE(v_timezone, 'America/Belize');

  v_starts_at := (p_appointment_date::TIMESTAMP + p_appointment_time) AT TIME ZONE v_timezone;
  v_ends_at := v_starts_at + MAKE_INTERVAL(mins => v_service.duration_minutes);
  v_local_now := NOW() AT TIME ZONE v_timezone;

  IF (p_appointment_date::TIMESTAMP + p_appointment_time) <= v_local_now THEN
    RAISE EXCEPTION 'Choose a future appointment time.' USING ERRCODE = '22023';
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_appointment_date)::SMALLINT;
  SELECT open_time, close_time, is_closed
  INTO v_open_time, v_close_time, v_is_closed
  FROM public.business_hours
  WHERE tenant_id = p_tenant_id
    AND day_of_week = v_day_of_week;

  IF NOT FOUND OR v_is_closed OR v_open_time IS NULL OR v_close_time IS NULL THEN
    RAISE EXCEPTION 'The business is closed on the selected date.' USING ERRCODE = 'P0001';
  END IF;
  IF p_appointment_time < v_open_time
     OR p_appointment_time + MAKE_INTERVAL(mins => v_service.duration_minutes) > v_close_time THEN
    RAISE EXCEPTION 'The selected time is outside business hours.' USING ERRCODE = 'P0001';
  END IF;

  -- Serialize bookings per tenant/day so the overlap check remains correct
  -- under concurrent requests.
  PERFORM pg_advisory_xact_lock(
    hashtext(p_tenant_id::TEXT),
    (p_appointment_date - DATE '2000-01-01')::INTEGER
  );

  IF EXISTS (
    SELECT 1
    FROM public.appointments appointment
    WHERE appointment.tenant_id = p_tenant_id
      AND UPPER(appointment.status) NOT IN ('CANCELLED', 'NO_SHOW')
      AND appointment.starts_at IS NOT NULL
      AND appointment.ends_at IS NOT NULL
      AND tstzrange(appointment.starts_at, appointment.ends_at, '[)')
          && tstzrange(v_starts_at, v_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'That time is no longer available. Choose another time.' USING ERRCODE = '23505';
  END IF;

  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE tenant_id = p_tenant_id
    AND LOWER(email) = p_customer_email
  ORDER BY created_at
  LIMIT 1;

  v_first_name := SPLIT_PART(p_customer_name, ' ', 1);
  v_last_name := NULLIF(BTRIM(SUBSTRING(p_customer_name FROM LENGTH(v_first_name) + 1)), '');

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      tenant_id,
      first_name,
      last_name,
      email,
      phone,
      notes,
      is_active
    )
    VALUES (
      p_tenant_id,
      v_first_name,
      COALESCE(v_last_name, ''),
      p_customer_email,
      p_customer_phone,
      NULL,
      TRUE
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET
      first_name = v_first_name,
      last_name = COALESCE(v_last_name, ''),
      phone = p_customer_phone,
      is_active = TRUE,
      updated_at = NOW()
    WHERE id = v_customer_id;
  END IF;

  IF COALESCE(v_service.requires_deposit, FALSE) THEN
    v_deposit := CASE
      WHEN v_service.deposit_type = 'percentage'
        THEN ROUND(v_service.price * COALESCE(v_service.deposit_amount, 0) / 100, 2)
      ELSE COALESCE(v_service.deposit_amount, 0)
    END;
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    customer_id,
    staff_id,
    service_id,
    appointment_date,
    appointment_time,
    starts_at,
    ends_at,
    customer_name,
    customer_email,
    customer_phone,
    status,
    notes,
    subtotal,
    deposit_required,
    total
  )
  VALUES (
    p_tenant_id,
    v_customer_id,
    NULL,
    p_service_id,
    p_appointment_date,
    p_appointment_time,
    v_starts_at,
    v_ends_at,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    'PENDING',
    p_notes,
    v_service.price,
    v_deposit,
    v_service.price
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.appointment_services (
    tenant_id,
    appointment_id,
    service_id,
    service_name,
    price,
    duration_minutes
  )
  VALUES (
    p_tenant_id,
    v_appointment_id,
    p_service_id,
    v_service.name,
    v_service.price,
    v_service.duration_minutes
  );

  RETURN v_appointment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_appointment(
  UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_public_appointment(
  UUID, UUID, DATE, TIME, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'appointments'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments';
  END IF;
END;
$$;

-- Make the newly-created RPC available to the Supabase Data API immediately.
-- PostgREST normally reloads automatically, but an explicit notification avoids
-- a stale function-signature cache after this migration is run in SQL Editor.
NOTIFY pgrst, 'reload schema';

COMMIT;
