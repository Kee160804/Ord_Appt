BEGIN;

-- Transactional email outbox. Appointment updates only enqueue work; the
-- external email request is performed asynchronously by a Supabase Edge
-- Function invoked through a Database Webhook.
CREATE TABLE IF NOT EXISTS public.appointment_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL
    REFERENCES public.tenants(id)
    ON DELETE CASCADE,
  appointment_id UUID NOT NULL
    REFERENCES public.appointments(id)
    ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'APPOINTMENT_CONFIRMED',
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

  CONSTRAINT appointment_email_event_unique
    UNIQUE (appointment_id, event_type),
  CONSTRAINT appointment_email_event_check
    CHECK (event_type IN ('APPOINTMENT_CONFIRMED')),
  CONSTRAINT appointment_email_status_check
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  CONSTRAINT appointment_email_attempt_count_check
    CHECK (attempt_count >= 0)
);

CREATE INDEX IF NOT EXISTS appointment_email_delivery_status_idx
  ON public.appointment_email_deliveries (status, created_at);

DROP TRIGGER IF EXISTS trg_appointment_email_deliveries_updated_at
ON public.appointment_email_deliveries;

CREATE TRIGGER trg_appointment_email_deliveries_updated_at
BEFORE UPDATE ON public.appointment_email_deliveries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.appointment_email_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS appointment_email_deliveries_select_policy
ON public.appointment_email_deliveries;

CREATE POLICY appointment_email_deliveries_select_policy
ON public.appointment_email_deliveries
FOR SELECT
TO authenticated
USING (public.user_has_tenant_access(tenant_id));

REVOKE ALL ON TABLE public.appointment_email_deliveries FROM anon, authenticated;
GRANT SELECT ON TABLE public.appointment_email_deliveries TO authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_appointment_confirmation_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_business_name TEXT;
  v_business_email TEXT;
  v_business_phone TEXT;
  v_business_address TEXT;
  v_business_city TEXT;
  v_service_name TEXT;
  v_timezone TEXT;
BEGIN
  IF UPPER(COALESCE(NEW.status, '')) <> 'CONFIRMED'
     OR UPPER(COALESCE(OLD.status, '')) = 'CONFIRMED' THEN
    RETURN NEW;
  END IF;

  -- A missing customer email should never prevent the status update itself.
  IF NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    tenant.business_name,
    tenant.email,
    tenant.phone,
    tenant.address,
    tenant.city
  INTO
    v_business_name,
    v_business_email,
    v_business_phone,
    v_business_address,
    v_business_city
  FROM public.tenants tenant
  WHERE tenant.id = NEW.tenant_id;

  SELECT appointment_service.service_name
  INTO v_service_name
  FROM public.appointment_services appointment_service
  WHERE appointment_service.appointment_id = NEW.id
  ORDER BY appointment_service.created_at
  LIMIT 1;

  IF v_service_name IS NULL AND NEW.service_id IS NOT NULL THEN
    SELECT service.name
    INTO v_service_name
    FROM public.services service
    WHERE service.id = NEW.service_id;
  END IF;

  SELECT COALESCE(NULLIF(settings.timezone, ''), 'America/Belize')
  INTO v_timezone
  FROM public.business_settings settings
  WHERE settings.tenant_id = NEW.tenant_id;

  v_business_name := COALESCE(NULLIF(v_business_name, ''), 'Your service provider');
  v_service_name := COALESCE(NULLIF(v_service_name, ''), 'Appointment');
  v_timezone := COALESCE(v_timezone, 'America/Belize');

  INSERT INTO public.appointment_email_deliveries (
    tenant_id,
    appointment_id,
    event_type,
    recipient_email,
    recipient_name,
    subject,
    payload
  )
  VALUES (
    NEW.tenant_id,
    NEW.id,
    'APPOINTMENT_CONFIRMED',
    LOWER(BTRIM(NEW.customer_email)),
    COALESCE(NULLIF(BTRIM(NEW.customer_name), ''), 'Customer'),
    'Your appointment with ' || v_business_name || ' is confirmed',
    JSONB_BUILD_OBJECT(
      'appointment_id', NEW.id,
      'confirmation_code', UPPER(LEFT(NEW.id::TEXT, 8)),
      'business_name', v_business_name,
      'business_email', v_business_email,
      'business_phone', v_business_phone,
      'business_address', v_business_address,
      'business_city', v_business_city,
      'service_name', v_service_name,
      'starts_at', NEW.starts_at,
      'appointment_date', NEW.appointment_date,
      'appointment_time', NEW.appointment_time,
      'timezone', v_timezone
    )
  )
  ON CONFLICT (appointment_id, event_type) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_appointment_confirmation_email()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_appointment_confirmation_email
ON public.appointments;

CREATE TRIGGER trg_enqueue_appointment_confirmation_email
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_appointment_confirmation_email();

NOTIFY pgrst, 'reload schema';

COMMIT;
