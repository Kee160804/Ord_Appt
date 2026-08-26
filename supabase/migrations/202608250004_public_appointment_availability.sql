BEGIN;

DROP FUNCTION IF EXISTS public.get_public_appointment_blocks(UUID, DATE);

CREATE OR REPLACE FUNCTION public.get_public_appointment_availability(
  p_tenant_id UUID,
  p_service_id UUID,
  p_appointment_date DATE
)
RETURNS TABLE (appointment_time TIME)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duration_minutes INTEGER;
  v_timezone TEXT;
  v_open_time TIME;
  v_close_time TIME;
  v_is_closed BOOLEAN;
  v_local_now TIMESTAMP;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants tenant
    WHERE tenant.id = p_tenant_id
      AND tenant.is_active = TRUE
      AND tenant.status = 'ACTIVE'
  ) THEN
    RETURN;
  END IF;

  SELECT service.duration_minutes
  INTO v_duration_minutes
  FROM public.services service
  WHERE service.id = p_service_id
    AND service.tenant_id = p_tenant_id
    AND service.available = TRUE;

  IF v_duration_minutes IS NULL OR v_duration_minutes <= 0 THEN
    RETURN;
  END IF;

  SELECT hours.open_time, hours.close_time, hours.is_closed
  INTO v_open_time, v_close_time, v_is_closed
  FROM public.business_hours hours
  WHERE hours.tenant_id = p_tenant_id
    AND hours.day_of_week = EXTRACT(DOW FROM p_appointment_date)::SMALLINT;

  IF NOT FOUND OR v_is_closed OR v_open_time IS NULL OR v_close_time IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(settings.timezone, ''), 'America/Belize')
  INTO v_timezone
  FROM public.business_settings settings
  WHERE settings.tenant_id = p_tenant_id;
  v_timezone := COALESCE(v_timezone, 'America/Belize');
  BEGIN
    v_local_now := NOW() AT TIME ZONE v_timezone;
  EXCEPTION WHEN OTHERS THEN
    v_timezone := 'America/Belize';
    v_local_now := NOW() AT TIME ZONE v_timezone;
  END;

  RETURN QUERY
  SELECT candidate.local_start::TIME
  FROM generate_series(
    p_appointment_date + v_open_time,
    p_appointment_date + v_close_time
      - MAKE_INTERVAL(mins => v_duration_minutes),
    MAKE_INTERVAL(mins => v_duration_minutes)
  ) AS candidate(local_start)
  WHERE candidate.local_start > v_local_now
    AND NOT EXISTS (
      SELECT 1
      FROM public.appointments appointment
      WHERE appointment.tenant_id = p_tenant_id
        AND UPPER(appointment.status) NOT IN ('CANCELLED', 'NO_SHOW')
        AND appointment.starts_at IS NOT NULL
        AND appointment.ends_at IS NOT NULL
        AND tstzrange(appointment.starts_at, appointment.ends_at, '[)')
          && tstzrange(
            candidate.local_start AT TIME ZONE v_timezone,
            (candidate.local_start + MAKE_INTERVAL(mins => v_duration_minutes))
              AT TIME ZONE v_timezone,
            '[)'
          )
    )
  ORDER BY candidate.local_start;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_appointment_availability(UUID, UUID, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_appointment_availability(UUID, UUID, DATE)
TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
