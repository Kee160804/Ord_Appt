BEGIN;

-- Repair deployments where the privacy migration was recorded or skipped but
-- its tables are absent. This is intentionally forward-only and idempotent.
CREATE TABLE IF NOT EXISTS public.privacy_requests (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  reference_code TEXT NOT NULL UNIQUE,
  request_type TEXT NOT NULL CHECK (
    request_type IN (
      'ACCESS', 'CORRECTION', 'DELETION', 'EXPORT', 'OBJECTION',
      'RESTRICTION', 'CONSENT_WITHDRAWAL', 'OTHER'
    )
  ),
  relationship TEXT NOT NULL CHECK (
    relationship IN (
      'ACCOUNT_HOLDER', 'BUSINESS_OWNER', 'STOREFRONT_CUSTOMER', 'OTHER'
    )
  ),
  requester_name TEXT NOT NULL
    CHECK (CHAR_LENGTH(requester_name) BETWEEN 2 AND 120),
  requester_email TEXT NOT NULL
    CHECK (CHAR_LENGTH(requester_email) BETWEEN 3 AND 254),
  business_reference TEXT,
  details TEXT NOT NULL CHECK (CHAR_LENGTH(details) BETWEEN 20 AND 5000),
  status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (
    status IN (
      'RECEIVED', 'IDENTITY_VERIFICATION', 'IN_PROGRESS', 'COMPLETED', 'DENIED'
    )
  ),
  identity_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    identity_status IN ('PENDING', 'VERIFIED', 'FAILED', 'NOT_REQUIRED')
  ),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_due_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  identity_verified_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  acknowledgement_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS privacy_requests_status_due_idx
  ON public.privacy_requests(status, target_due_at, created_at);
CREATE INDEX IF NOT EXISTS privacy_requests_email_created_idx
  ON public.privacy_requests(LOWER(requester_email), created_at DESC);

CREATE TABLE IF NOT EXISTS public.privacy_request_events (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  request_id UUID NOT NULL
    REFERENCES public.privacy_requests(id) ON DELETE CASCADE,
  actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'SUBMITTED', 'STATUS_CHANGED', 'IDENTITY_CHANGED', 'NOTE_UPDATED',
      'ASSIGNED'
    )
  ),
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS privacy_request_events_request_created_idx
  ON public.privacy_request_events(request_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.record_privacy_request_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.privacy_request_events (
    request_id, event_type, new_value
  ) VALUES (
    NEW.id, 'SUBMITTED', NEW.status
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_privacy_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_profile_id, event_type, old_value, new_value, notes
    ) VALUES (
      NEW.id, NEW.assigned_to, 'STATUS_CHANGED', OLD.status, NEW.status,
      NEW.resolution_notes
    );
  END IF;

  IF OLD.identity_status IS DISTINCT FROM NEW.identity_status THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_profile_id, event_type, old_value, new_value, notes
    ) VALUES (
      NEW.id, NEW.assigned_to, 'IDENTITY_CHANGED', OLD.identity_status,
      NEW.identity_status, NEW.resolution_notes
    );
  END IF;

  IF OLD.resolution_notes IS DISTINCT FROM NEW.resolution_notes THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_profile_id, event_type, notes
    ) VALUES (
      NEW.id, NEW.assigned_to, 'NOTE_UPDATED', NEW.resolution_notes
    );
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.privacy_request_events (
      request_id, actor_profile_id, event_type, old_value, new_value
    ) VALUES (
      NEW.id, NEW.assigned_to, 'ASSIGNED', OLD.assigned_to::TEXT,
      NEW.assigned_to::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_privacy_request_submission()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_privacy_request_update()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_privacy_requests_updated_at
  ON public.privacy_requests;
CREATE TRIGGER trg_privacy_requests_updated_at
BEFORE UPDATE ON public.privacy_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_privacy_request_submitted
  ON public.privacy_requests;
CREATE TRIGGER trg_privacy_request_submitted
AFTER INSERT ON public.privacy_requests
FOR EACH ROW EXECUTE FUNCTION public.record_privacy_request_submission();

DROP TRIGGER IF EXISTS trg_privacy_request_updated
  ON public.privacy_requests;
CREATE TRIGGER trg_privacy_request_updated
AFTER UPDATE ON public.privacy_requests
FOR EACH ROW EXECUTE FUNCTION public.record_privacy_request_update();

-- A later notification migration may have skipped this trigger because the
-- table was missing at the time. Reattach it when that function is present.
DO $block$
BEGIN
  IF TO_REGPROCEDURE('public.enqueue_platform_privacy_notification()')
       IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_platform_privacy_notification
      ON public.privacy_requests;
    CREATE TRIGGER trg_platform_privacy_notification
    AFTER INSERT ON public.privacy_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.enqueue_platform_privacy_notification();
  END IF;
END;
$block$;

ALTER TABLE public.privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_request_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS privacy_requests_super_admin_select
  ON public.privacy_requests;
CREATE POLICY privacy_requests_super_admin_select
  ON public.privacy_requests
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS privacy_request_events_super_admin_select
  ON public.privacy_request_events;
CREATE POLICY privacy_request_events_super_admin_select
  ON public.privacy_request_events
  FOR SELECT TO authenticated
  USING ((SELECT public.is_super_admin()));

REVOKE ALL ON TABLE public.privacy_requests, public.privacy_request_events
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.privacy_requests, public.privacy_request_events
  TO authenticated;
GRANT ALL ON TABLE public.privacy_requests, public.privacy_request_events
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
