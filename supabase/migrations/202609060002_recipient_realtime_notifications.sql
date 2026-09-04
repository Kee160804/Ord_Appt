BEGIN;

-- In-app notifications are delivery records, not email jobs. Each row belongs
-- to exactly one tenant member so read state can never leak across recipients.
ALTER TABLE public.business_notifications
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.business_notifications
  DROP CONSTRAINT IF EXISTS business_notifications_type_check;
ALTER TABLE public.business_notifications
  ADD CONSTRAINT business_notifications_type_check CHECK (type IN (
    'ORDER', 'APPOINTMENT', 'CANCELLATION', 'RESCHEDULE', 'CUSTOMER',
    'LOW_INVENTORY', 'SUBSCRIPTION', 'TRIAL', 'PROMOTION', 'SYSTEM'
  ));

-- Replace the former tenant-wide event uniqueness with recipient uniqueness.
DROP INDEX IF EXISTS public.business_notifications_source_event_idx;
DROP INDEX IF EXISTS public.business_notifications_tenant_recipient_idx;

-- Preserve legacy notifications by making one copy for every active member.
-- A legacy row for a tenant without members has no valid recipient and is
-- intentionally removed before recipient_id becomes required.
INSERT INTO public.business_notifications (
  id, tenant_id, recipient_id, type, title, message, source_table, source_id,
  event_key, href, is_read, read_at, created_at, metadata
)
SELECT
  gen_random_uuid(), notification.tenant_id, membership.profile_id,
  notification.type, notification.title, notification.message,
  notification.source_table, notification.source_id, notification.event_key,
  notification.href, notification.is_read, notification.read_at,
  notification.created_at, COALESCE(notification.metadata, '{}'::JSONB)
FROM public.business_notifications notification
JOIN public.tenant_memberships membership
  ON membership.tenant_id = notification.tenant_id
 AND membership.is_active = TRUE
JOIN public.profiles profile
  ON profile.id = membership.profile_id
 AND profile.is_active = TRUE
WHERE notification.recipient_id IS NULL;

DELETE FROM public.business_notifications WHERE recipient_id IS NULL;

ALTER TABLE public.business_notifications
  ALTER COLUMN recipient_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_notifications_recipient_source_event_idx
  ON public.business_notifications
    (tenant_id, recipient_id, source_table, source_id, event_key)
  WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_notifications_recipient_unread_idx
  ON public.business_notifications (recipient_id, tenant_id, is_read, created_at DESC);

-- Full old/new rows let the client adjust the unread badge immediately for
-- UPDATE and DELETE events without a second fetch.
ALTER TABLE public.business_notifications REPLICA IDENTITY FULL;

-- A compatibility guard gives legacy direct inserts (for example storefront
-- contact messages) a deterministic owner recipient. New event triggers below
-- use the fan-out helper and always provide recipient_id themselves.
CREATE OR REPLACE FUNCTION public.assign_business_notification_recipient()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.recipient_id IS NULL THEN
    SELECT membership.profile_id INTO NEW.recipient_id
    FROM public.tenant_memberships membership
    JOIN public.roles role
      ON role.id = membership.role_id
     AND role.tenant_id = membership.tenant_id
    JOIN public.profiles profile
      ON profile.id = membership.profile_id
     AND profile.is_active = TRUE
    WHERE membership.tenant_id = NEW.tenant_id
      AND membership.is_active = TRUE
    ORDER BY CASE WHEN UPPER(role.name) = 'OWNER' THEN 0 ELSE 1 END,
      membership.joined_at, membership.id
    LIMIT 1;
  END IF;

  IF NEW.recipient_id IS NULL THEN
    RAISE EXCEPTION 'A business notification requires an active recipient.'
      USING ERRCODE = '23502';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_business_notification_recipient()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_assign_business_notification_recipient
  ON public.business_notifications;
CREATE TRIGGER trg_assign_business_notification_recipient
BEFORE INSERT ON public.business_notifications
FOR EACH ROW EXECUTE FUNCTION public.assign_business_notification_recipient();

-- Internal, idempotent fan-out. ALL reaches every active tenant member,
-- MANAGEMENT reaches owner/admin/manager, and OWNER reaches owners only.
CREATE OR REPLACE FUNCTION public.notify_tenant_members(
  p_tenant_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_source_table TEXT,
  p_source_id UUID,
  p_event_key TEXT,
  p_href TEXT,
  p_audience TEXT DEFAULT 'ALL',
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  IF UPPER(COALESCE(p_audience, 'ALL')) NOT IN ('ALL', 'MANAGEMENT', 'OWNER') THEN
    RAISE EXCEPTION 'Unknown notification audience.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.business_notifications (
    tenant_id, recipient_id, type, title, message, source_table, source_id,
    event_key, href, metadata
  )
  SELECT
    p_tenant_id, membership.profile_id, UPPER(p_type), p_title, p_message,
    p_source_table, p_source_id, p_event_key, p_href,
    COALESCE(p_metadata, '{}'::JSONB)
  FROM public.tenant_memberships membership
  JOIN public.roles role
    ON role.id = membership.role_id
   AND role.tenant_id = membership.tenant_id
  JOIN public.profiles profile
    ON profile.id = membership.profile_id
   AND profile.is_active = TRUE
  WHERE membership.tenant_id = p_tenant_id
    AND membership.is_active = TRUE
    AND (
      UPPER(COALESCE(p_audience, 'ALL')) = 'ALL'
      OR (UPPER(p_audience) = 'MANAGEMENT'
          AND UPPER(role.name) IN ('OWNER', 'ADMIN', 'MANAGER'))
      OR (UPPER(p_audience) = 'OWNER' AND UPPER(role.name) = 'OWNER')
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_tenant_members(
  UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

-- Orders and appointments use one trigger function so event ordering and
-- de-duplication stay consistent. Reschedules are detected independently of
-- status changes and link directly to the relevant record.
CREATE OR REPLACE FUNCTION public.enqueue_business_activity_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_status TEXT := UPPER(COALESCE(NEW.status, ''));
  v_old_status TEXT;
  v_changed BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_status := UPPER(COALESCE(OLD.status, ''));
  END IF;

  BEGIN
    IF TG_TABLE_NAME = 'orders' THEN
      IF TG_OP = 'INSERT' THEN
        PERFORM public.notify_tenant_members(
          NEW.tenant_id, 'ORDER', 'New order',
          'Order ' || COALESCE(NEW.order_number, '') || ' was placed by ' ||
            COALESCE(NEW.customer_name, 'a customer') || '.',
          'orders', NEW.id, 'CREATED',
          '/dashboard/orders?order=' || NEW.id::TEXT, 'ALL',
          JSONB_BUILD_OBJECT('order_id', NEW.id, 'customer_id', NEW.customer_id)
        );
      ELSIF v_status = 'CANCELLED' AND v_old_status <> 'CANCELLED' THEN
        PERFORM public.notify_tenant_members(
          NEW.tenant_id, 'CANCELLATION', 'Order cancelled',
          'Order ' || COALESCE(NEW.order_number, '') || ' was cancelled.',
          'orders', NEW.id, 'CANCELLED',
          '/dashboard/orders?order=' || NEW.id::TEXT, 'ALL',
          JSONB_BUILD_OBJECT('order_id', NEW.id, 'customer_id', NEW.customer_id)
        );
      END IF;
    ELSE
      IF TG_OP = 'INSERT' THEN
        PERFORM public.notify_tenant_members(
          NEW.tenant_id, 'APPOINTMENT', 'New appointment',
          COALESCE(NEW.customer_name, 'A customer') || ' requested an appointment.',
          'appointments', NEW.id, 'CREATED',
          '/dashboard/appointments?appointment=' || NEW.id::TEXT, 'ALL',
          JSONB_BUILD_OBJECT('appointment_id', NEW.id, 'customer_id', NEW.customer_id)
        );
      ELSE
        IF v_status = 'CANCELLED' AND v_old_status <> 'CANCELLED' THEN
          PERFORM public.notify_tenant_members(
            NEW.tenant_id, 'CANCELLATION', 'Appointment cancelled',
            COALESCE(NEW.customer_name, 'A customer') || '''s appointment was cancelled.',
            'appointments', NEW.id, 'CANCELLED',
            '/dashboard/appointments?appointment=' || NEW.id::TEXT, 'ALL',
            JSONB_BUILD_OBJECT('appointment_id', NEW.id, 'customer_id', NEW.customer_id)
          );
        END IF;

        v_changed := OLD.starts_at IS DISTINCT FROM NEW.starts_at
          OR OLD.appointment_date IS DISTINCT FROM NEW.appointment_date
          OR OLD.appointment_time IS DISTINCT FROM NEW.appointment_time;
        IF v_status <> 'CANCELLED' AND v_changed THEN
          PERFORM public.notify_tenant_members(
            NEW.tenant_id, 'RESCHEDULE', 'Appointment rescheduled',
            COALESCE(NEW.customer_name, 'A customer') || '''s appointment was rescheduled.',
            'appointments', NEW.id,
            'RESCHEDULED_' || COALESCE(NEW.starts_at::TEXT,
              NEW.appointment_date::TEXT || '_' || NEW.appointment_time::TEXT),
            '/dashboard/appointments?appointment=' || NEW.id::TEXT, 'ALL',
            JSONB_BUILD_OBJECT('appointment_id', NEW.id, 'customer_id', NEW.customer_id,
              'starts_at', NEW.starts_at)
          );
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '% % saved but in-app notification failed: %',
      TG_TABLE_NAME, NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_business_activity_notification()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_business_order_notification ON public.orders;
CREATE TRIGGER trg_business_order_notification
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.enqueue_business_activity_notification();

DROP TRIGGER IF EXISTS trg_business_appointment_notification ON public.appointments;
DROP TRIGGER IF EXISTS trg_appointment_reschedule_notification ON public.appointments;
CREATE TRIGGER trg_business_appointment_notification
AFTER INSERT OR UPDATE OF status, starts_at, appointment_date, appointment_time
ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_business_activity_notification();

CREATE OR REPLACE FUNCTION public.enqueue_low_inventory_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(NEW.track_inventory, NEW.stock IS NOT NULL)
     AND NEW.stock IS NOT NULL AND NEW.stock <= 5
     AND (TG_OP = 'INSERT' OR OLD.stock IS NULL OR OLD.stock > 5 OR OLD.stock <> NEW.stock) THEN
    BEGIN
      PERFORM public.notify_tenant_members(
        NEW.tenant_id, 'LOW_INVENTORY', 'Low inventory',
        NEW.name || ' has ' || NEW.stock || ' remaining.',
        'products', NEW.id, 'LOW_STOCK_' || NEW.stock::TEXT || '_' ||
          TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSUS'),
        '/dashboard/products?product=' || NEW.id::TEXT, 'MANAGEMENT',
        JSONB_BUILD_OBJECT('product_id', NEW.id, 'stock', NEW.stock)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Product % saved but low-stock notification failed: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_low_inventory_notification()
  FROM PUBLIC, anon, authenticated;

-- New customers are management-facing because staff routes intentionally do
-- not include CRM. This also supplies a direct customer notification target.
CREATE OR REPLACE FUNCTION public.enqueue_new_customer_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    PERFORM public.notify_tenant_members(
      NEW.tenant_id, 'CUSTOMER', 'New customer',
      COALESCE(NULLIF(BTRIM(CONCAT_WS(' ', NEW.first_name, NEW.last_name)), ''),
        NULLIF(NEW.email, ''), 'A customer') || ' was added.',
      'customers', NEW.id, 'CREATED',
      '/dashboard/customers?customer=' || NEW.id::TEXT, 'MANAGEMENT',
      JSONB_BUILD_OBJECT('customer_id', NEW.id)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Customer % saved but in-app notification failed: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_new_customer_notification()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_new_customer_notification ON public.customers;
CREATE TRIGGER trg_new_customer_notification
AFTER INSERT ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.enqueue_new_customer_notification();

CREATE OR REPLACE FUNCTION public.enqueue_promotion_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' AND NEW.is_active THEN
    v_action := 'created';
  ELSIF TG_OP = 'UPDATE' AND NEW.is_active
        AND (OLD.is_active IS DISTINCT FROM NEW.is_active
          OR OLD.code IS DISTINCT FROM NEW.code
          OR OLD.discount_type IS DISTINCT FROM NEW.discount_type
          OR OLD.discount_value IS DISTINCT FROM NEW.discount_value
          OR OLD.ends_at IS DISTINCT FROM NEW.ends_at) THEN
    v_action := CASE WHEN OLD.is_active = FALSE THEN 'activated' ELSE 'updated' END;
  ELSE
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.notify_tenant_members(
      NEW.tenant_id, 'PROMOTION', 'Promotion ' || v_action,
      'Promo code ' || UPPER(NEW.code) || ' was ' || v_action || '.',
      'promotions', NEW.id,
      'PROMOTION_' || UPPER(v_action) || '_' ||
        TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSUS'),
      '/dashboard/tools?section=promotions&promotion=' || NEW.id::TEXT,
      'MANAGEMENT', JSONB_BUILD_OBJECT('promotion_id', NEW.id, 'code', NEW.code)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Promotion % saved but in-app notification failed: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_promotion_notification()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_promotion_created_notification ON public.promotions;
CREATE TRIGGER trg_promotion_created_notification
AFTER INSERT OR UPDATE OF is_active, code, discount_type, discount_value, ends_at
ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.enqueue_promotion_notification();

CREATE OR REPLACE FUNCTION public.enqueue_subscription_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_type TEXT := 'SUBSCRIPTION';
  v_title TEXT;
  v_message TEXT;
  v_event_key TEXT;
  v_new_status TEXT := LOWER(COALESCE(NEW.subscription_status, 'trial'));
  v_old_status TEXT := LOWER(COALESCE(OLD.subscription_status, 'trial'));
BEGIN
  IF NEW.plan IS NOT DISTINCT FROM OLD.plan
     AND NEW.subscription_status IS NOT DISTINCT FROM OLD.subscription_status
     AND NEW.trial_ends_at IS NOT DISTINCT FROM OLD.trial_ends_at THEN
    RETURN NEW;
  END IF;

  IF v_new_status = 'active' AND v_old_status <> 'active' THEN
    v_title := 'Subscription active';
    v_message := 'Your ' || INITCAP(COALESCE(NEW.plan, 'starter')) || ' subscription is active.';
    v_event_key := 'SUBSCRIPTION_ACTIVE_' ||
      TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSUS');
  ELSIF v_new_status IN ('past_due', 'cancelled') AND v_old_status <> v_new_status THEN
    v_title := 'Subscription ' || REPLACE(v_new_status, '_', ' ');
    v_message := 'Your subscription needs attention.';
    v_event_key := 'SUBSCRIPTION_' || UPPER(v_new_status) || '_' ||
      TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSUS');
  ELSIF v_new_status = 'trial' AND NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    v_type := 'TRIAL';
    v_title := 'Trial updated';
    v_message := CASE WHEN NEW.trial_ends_at IS NULL
      THEN 'Your trial end date was updated.'
      ELSE 'Your trial now ends ' || TO_CHAR(NEW.trial_ends_at, 'Mon DD, YYYY') || '.' END;
    v_event_key := 'TRIAL_UPDATED_' || COALESCE(
      NEW.trial_ends_at::TEXT,
      TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSUS')
    );
  ELSE
    v_title := 'Plan updated';
    v_message := 'Your plan was updated to ' || INITCAP(COALESCE(NEW.plan, 'starter')) || '.';
    v_event_key := 'PLAN_UPDATED_' ||
      TO_CHAR(CLOCK_TIMESTAMP(), 'YYYYMMDDHH24MISSUS');
  END IF;

  BEGIN
    PERFORM public.notify_tenant_members(
      NEW.id, v_type, v_title, v_message, 'tenants', NEW.id, v_event_key,
      '/dashboard/settings?section=subscription', 'OWNER',
      JSONB_BUILD_OBJECT('tenant_id', NEW.id, 'plan', NEW.plan,
        'subscription_status', NEW.subscription_status, 'trial_ends_at', NEW.trial_ends_at)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Subscription updated but in-app notification failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_subscription_notification()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_subscription_change_notification ON public.tenants;
CREATE TRIGGER trg_subscription_change_notification
AFTER UPDATE OF plan, subscription_status, trial_ends_at ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.enqueue_subscription_notification();

-- Called when the bell initializes. It creates an idempotent owner alert when
-- a trial is within three days of ending, without depending on email/Resend.
CREATE OR REPLACE FUNCTION public.enqueue_due_business_notifications(p_tenant_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant public.tenants%ROWTYPE; v_count INTEGER := 0;
BEGIN
  IF NOT public.user_has_tenant_access(p_tenant_id)
     AND NOT public.is_super_admin()
     AND COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Business access required.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = p_tenant_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF LOWER(COALESCE(v_tenant.subscription_status, 'trial')) = 'trial'
     AND v_tenant.trial_ends_at IS NOT NULL
     AND v_tenant.trial_ends_at <= NOW() + INTERVAL '3 days' THEN
    v_count := public.notify_tenant_members(
      v_tenant.id, 'TRIAL',
      CASE WHEN v_tenant.trial_ends_at <= NOW() THEN 'Trial ended' ELSE 'Trial ending soon' END,
      CASE WHEN v_tenant.trial_ends_at <= NOW()
        THEN 'Your trial has ended. Choose a plan to restore full access.'
        ELSE 'Your trial ends ' || TO_CHAR(v_tenant.trial_ends_at, 'Mon DD, YYYY') || '.' END,
      'tenants', v_tenant.id,
      CASE WHEN v_tenant.trial_ends_at <= NOW() THEN 'TRIAL_ENDED_' ELSE 'TRIAL_ENDING_' END
        || v_tenant.trial_ends_at::DATE::TEXT,
      '/dashboard/settings?section=subscription', 'OWNER',
      JSONB_BUILD_OBJECT('tenant_id', v_tenant.id, 'trial_ends_at', v_tenant.trial_ends_at)
    );
  END IF;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_due_business_notifications(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_due_business_notifications(UUID) TO authenticated;

-- Service-role code and super admins can send a tenant alert without granting
-- ordinary users arbitrary INSERT access to the notification table.
CREATE OR REPLACE FUNCTION public.create_business_system_notification(
  p_tenant_id UUID, p_title TEXT, p_message TEXT,
  p_href TEXT DEFAULT '/dashboard', p_recipient_id UUID DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER := 0;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Platform administrator access required.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(BTRIM(COALESCE(p_title, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(p_message, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A title and message are required.' USING ERRCODE = '22023';
  END IF;

  IF p_recipient_id IS NULL THEN
    v_count := public.notify_tenant_members(
      p_tenant_id, 'SYSTEM', BTRIM(p_title), BTRIM(p_message), 'tenants',
      p_tenant_id, 'SYSTEM_' || gen_random_uuid()::TEXT,
      COALESCE(NULLIF(BTRIM(p_href), ''), '/dashboard'), 'ALL', '{}'::JSONB
    );
  ELSE
    INSERT INTO public.business_notifications (
      tenant_id, recipient_id, type, title, message, source_table, source_id,
      event_key, href
    )
    SELECT p_tenant_id, membership.profile_id, 'SYSTEM', BTRIM(p_title),
      BTRIM(p_message), 'tenants', p_tenant_id,
      'SYSTEM_' || gen_random_uuid()::TEXT,
      COALESCE(NULLIF(BTRIM(p_href), ''), '/dashboard')
    FROM public.tenant_memberships membership
    WHERE membership.tenant_id = p_tenant_id
      AND membership.profile_id = p_recipient_id
      AND membership.is_active = TRUE;
    GET DIAGNOSTICS v_count = ROW_COUNT;
  END IF;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.create_business_system_notification(UUID, TEXT, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;

-- Strict tenant + recipient isolation. There is no tenant-wide NULL recipient
-- escape hatch, and a user cannot mutate another member's read state.
ALTER TABLE public.business_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_notifications_member_read ON public.business_notifications;
CREATE POLICY business_notifications_member_read ON public.business_notifications
  FOR SELECT TO authenticated
  USING (
    (recipient_id = auth.uid() AND public.user_has_tenant_access(tenant_id))
    OR public.is_super_admin()
  );
DROP POLICY IF EXISTS business_notifications_member_update ON public.business_notifications;
CREATE POLICY business_notifications_member_update ON public.business_notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid() AND public.user_has_tenant_access(tenant_id))
  WITH CHECK (recipient_id = auth.uid() AND public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS business_notifications_member_delete ON public.business_notifications;
CREATE POLICY business_notifications_member_delete ON public.business_notifications
  FOR DELETE TO authenticated
  USING (recipient_id = auth.uid() AND public.user_has_tenant_access(tenant_id));

-- Subscription/trial notifications must remain readable even when product
-- access is paused, so this table intentionally has no subscription RLS gate.
DROP POLICY IF EXISTS business_notifications_subscription_required
  ON public.business_notifications;

REVOKE ALL ON TABLE public.business_notifications FROM anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.business_notifications TO authenticated;
GRANT UPDATE (is_read, read_at) ON public.business_notifications TO authenticated;

-- In-app inserts must never enqueue Resend/email. Domain email triggers remain
-- separate, but this coupling trigger is explicitly removed.
DROP TRIGGER IF EXISTS trg_enqueue_business_alert_email
  ON public.business_notifications;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'business_notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.business_notifications;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
