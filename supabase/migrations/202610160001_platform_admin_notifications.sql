BEGIN;

-- Platform notifications are deliberately separate from tenant-facing
-- business_notifications. Each active Super Admin receives an independent row
-- so read and dismissal state remain personal.
CREATE TABLE IF NOT EXISTS public.platform_notifications (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'ACCOUNT', 'TENANT', 'TEAM', 'ORDER', 'APPOINTMENT',
    'PAYMENT', 'SUBSCRIPTION', 'PRIVACY', 'SYSTEM'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '/admin',
  source_table TEXT NOT NULL,
  source_id TEXT,
  event_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_notifications_recipient_event_idx
  ON public.platform_notifications
    (recipient_id, source_table, source_id, event_key)
  WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS platform_notifications_recipient_unread_idx
  ON public.platform_notifications (recipient_id, is_read, created_at DESC);

ALTER TABLE public.platform_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.platform_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_notifications_recipient_select
  ON public.platform_notifications;
CREATE POLICY platform_notifications_recipient_select
  ON public.platform_notifications FOR SELECT TO authenticated
  USING (recipient_id = auth.uid() AND public.is_super_admin());

DROP POLICY IF EXISTS platform_notifications_recipient_update
  ON public.platform_notifications;
CREATE POLICY platform_notifications_recipient_update
  ON public.platform_notifications FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() AND public.is_super_admin())
  WITH CHECK (recipient_id = auth.uid() AND public.is_super_admin());

DROP POLICY IF EXISTS platform_notifications_recipient_delete
  ON public.platform_notifications;
CREATE POLICY platform_notifications_recipient_delete
  ON public.platform_notifications FOR DELETE TO authenticated
  USING (recipient_id = auth.uid() AND public.is_super_admin());

REVOKE ALL ON public.platform_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.platform_notifications TO authenticated;
GRANT UPDATE (is_read, read_at) ON public.platform_notifications TO authenticated;
GRANT ALL ON public.platform_notifications TO service_role;

-- Internal idempotent fan-out to every active platform administrator.
CREATE OR REPLACE FUNCTION public.notify_platform_admins(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_source_table TEXT,
  p_source_id TEXT,
  p_event_key TEXT,
  p_href TEXT DEFAULT '/admin',
  p_tenant_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  INSERT INTO public.platform_notifications (
    recipient_id, tenant_id, type, title, message, href,
    source_table, source_id, event_key, metadata
  )
  SELECT
    profile.id, p_tenant_id, UPPER(p_type), p_title, p_message,
    COALESCE(NULLIF(p_href, ''), '/admin'), p_source_table, p_source_id,
    p_event_key, COALESCE(p_metadata, '{}'::JSONB)
  FROM public.profiles profile
  WHERE profile.is_active = TRUE
    AND UPPER(COALESCE(profile.platform_role, '')) = 'SUPER_ADMIN'
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_platform_admins(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_platform_profile_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    PERFORM public.notify_platform_admins(
      'ACCOUNT', 'New platform account',
      COALESCE(NULLIF(NEW.full_name, ''), 'A new user') ||
        ' registered with ' || COALESCE(NEW.email, 'an unknown email') || '.',
      'profiles', NEW.id::TEXT, 'REGISTERED', '/admin', NULL,
      JSONB_BUILD_OBJECT('email', NEW.email, 'name', NEW.full_name)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Profile % saved but platform notification failed: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_platform_profile_notification()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_platform_profile_notification ON public.profiles;
CREATE TRIGGER trg_platform_profile_notification
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enqueue_platform_profile_notification();

CREATE OR REPLACE FUNCTION public.enqueue_platform_tenant_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    PERFORM public.notify_platform_admins(
      'TENANT', 'New business onboarded',
      NEW.business_name || ' joined YuhBusiness on the ' ||
        COALESCE(NEW.plan, 'starter') || ' plan.',
      'tenants', NEW.id::TEXT, 'CREATED',
      '/admin/tenant/' || NEW.id::TEXT, NEW.id,
      JSONB_BUILD_OBJECT(
        'businessName', NEW.business_name,
        'businessType', NEW.business_type,
        'plan', NEW.plan
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Tenant % saved but platform notification failed: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_platform_tenant_notification()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_platform_tenant_notification ON public.tenants;
CREATE TRIGGER trg_platform_tenant_notification
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.enqueue_platform_tenant_notification();

CREATE OR REPLACE FUNCTION public.enqueue_platform_team_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_business TEXT;
  v_action TEXT := REPLACE(INITCAP(LOWER(NEW.action)), '_', ' ');
BEGIN
  SELECT tenant.business_name INTO v_business
  FROM public.tenants tenant WHERE tenant.id = NEW.tenant_id;

  BEGIN
    PERFORM public.notify_platform_admins(
      'TEAM', v_action,
      v_action || ' for ' || COALESCE(v_business, 'a business') || '.',
      'team_access_events', NEW.id::TEXT, NEW.action,
      '/admin/tenant/' || NEW.tenant_id::TEXT, NEW.tenant_id,
      COALESCE(NEW.details, '{}'::JSONB) || JSONB_BUILD_OBJECT('action', NEW.action)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Team event % saved but platform notification failed: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_platform_team_notification()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_platform_team_notification ON public.team_access_events;
CREATE TRIGGER trg_platform_team_notification
AFTER INSERT ON public.team_access_events
FOR EACH ROW EXECUTE FUNCTION public.enqueue_platform_team_notification();

CREATE OR REPLACE FUNCTION public.enqueue_platform_activity_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_business TEXT;
  v_type TEXT;
  v_title TEXT;
  v_label TEXT;
  v_amount NUMERIC;
BEGIN
  SELECT tenant.business_name INTO v_business
  FROM public.tenants tenant WHERE tenant.id = NEW.tenant_id;

  IF TG_TABLE_NAME = 'orders' THEN
    v_type := 'ORDER';
    v_title := 'New public order';
    v_label := COALESCE(NEW.order_number, NEW.id::TEXT);
    v_amount := COALESCE(NEW.total, 0);
  ELSE
    v_type := 'APPOINTMENT';
    v_title := 'New public appointment';
    v_label := NEW.id::TEXT;
    v_amount := COALESCE(NEW.total, NEW.subtotal, 0);
  END IF;

  BEGIN
    PERFORM public.notify_platform_admins(
      v_type, v_title,
      COALESCE(v_business, 'A business') || ' received ' || LOWER(v_title) ||
        ' (' || v_label || ') for ' || v_amount::TEXT || ' BZD.',
      TG_TABLE_NAME, NEW.id::TEXT, 'CREATED',
      '/admin/tenant/' || NEW.tenant_id::TEXT, NEW.tenant_id,
      JSONB_BUILD_OBJECT('amount', v_amount, 'status', NEW.status)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '% % saved but platform notification failed: %', TG_TABLE_NAME, NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_platform_activity_notification()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_platform_order_notification ON public.orders;
CREATE TRIGGER trg_platform_order_notification
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_platform_activity_notification();

DROP TRIGGER IF EXISTS trg_platform_appointment_notification ON public.appointments;
CREATE TRIGGER trg_platform_appointment_notification
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_platform_activity_notification();

CREATE OR REPLACE FUNCTION public.enqueue_platform_payment_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_business TEXT;
  v_title TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT tenant.business_name INTO v_business
  FROM public.tenants tenant WHERE tenant.id = NEW.tenant_id;
  v_title := CASE
    WHEN NEW.status = 'SUCCEEDED' THEN 'Payment confirmed'
    WHEN NEW.status = 'FAILED' THEN 'Payment failed'
    WHEN NEW.status IN ('REFUNDED', 'PARTIALLY_REFUNDED') THEN 'Payment refunded'
    ELSE 'Payment activity'
  END;

  BEGIN
    PERFORM public.notify_platform_admins(
      CASE WHEN NEW.kind = 'SUBSCRIPTION' THEN 'SUBSCRIPTION' ELSE 'PAYMENT' END,
      v_title,
      COALESCE(v_business, 'A business') || ' has a ' || LOWER(NEW.kind) ||
        ' payment of ' || NEW.amount::TEXT || ' ' || NEW.currency ||
        ' with status ' || NEW.status || '.',
      'payment_transactions', NEW.id::TEXT, NEW.status,
      '/admin/tenant/' || NEW.tenant_id::TEXT, NEW.tenant_id,
      JSONB_BUILD_OBJECT(
        'kind', NEW.kind, 'status', NEW.status, 'amount', NEW.amount,
        'currency', NEW.currency, 'provider', NEW.provider,
        'providerReference', NEW.provider_reference
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Payment % saved but platform notification failed: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_platform_payment_notification()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_platform_payment_notification ON public.payment_transactions;
CREATE TRIGGER trg_platform_payment_notification
AFTER INSERT OR UPDATE OF status ON public.payment_transactions
FOR EACH ROW EXECUTE FUNCTION public.enqueue_platform_payment_notification();

CREATE OR REPLACE FUNCTION public.enqueue_platform_privacy_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    PERFORM public.notify_platform_admins(
      'PRIVACY', 'New privacy request',
      NEW.requester_name || ' submitted a ' || NEW.request_type ||
        ' request (' || NEW.reference_code || ').',
      'privacy_requests', NEW.id::TEXT, 'RECEIVED', '/admin', NULL,
      JSONB_BUILD_OBJECT(
        'referenceCode', NEW.reference_code,
        'requestType', NEW.request_type
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Privacy request % saved but platform notification failed: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_platform_privacy_notification()
  FROM PUBLIC, anon, authenticated;

-- Privacy operations were introduced in a later optional migration on some
-- deployments. PostgreSQL still errors on `DROP TRIGGER IF EXISTS ... ON`
-- when the table itself is absent, so attach this trigger conditionally.
DO $$
BEGIN
  IF TO_REGCLASS('public.privacy_requests') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_platform_privacy_notification ON public.privacy_requests';
    EXECUTE 'CREATE TRIGGER trg_platform_privacy_notification
      AFTER INSERT ON public.privacy_requests
      FOR EACH ROW EXECUTE FUNCTION public.enqueue_platform_privacy_notification()';
  END IF;
END;
$$;

-- Make the new table available to Supabase Realtime when it is not already in
-- the publication. The guard keeps local/repeated migration runs idempotent.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'platform_notifications'
     )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_notifications;
  END IF;
END;
$$;

-- Give each existing Super Admin a visible confirmation after deployment.
INSERT INTO public.platform_notifications (
  recipient_id, type, title, message, source_table, source_id, event_key, href
)
SELECT
  profile.id, 'SYSTEM', 'Platform monitoring enabled',
  'The admin bell is now receiving account, tenant, team, commerce, payment, and privacy events.',
  'system', 'platform-monitoring-v1', 'ENABLED', '/admin'
FROM public.profiles profile
WHERE profile.is_active = TRUE
  AND UPPER(COALESCE(profile.platform_role, '')) = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
