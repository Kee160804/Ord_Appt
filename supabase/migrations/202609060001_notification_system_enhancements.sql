BEGIN;

-- 1. Add recipient_id column to business_notifications to allow targeting
-- specific users (e.g. business owner only for billing/subscription alerts),
-- while NULL targets all authenticated members of the tenant.
ALTER TABLE public.business_notifications
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Expand type CHECK constraint to include RESCHEDULE, SUBSCRIPTION, and PROMOTION
ALTER TABLE public.business_notifications
  DROP CONSTRAINT IF EXISTS business_notifications_type_check;

ALTER TABLE public.business_notifications
  ADD CONSTRAINT business_notifications_type_check
  CHECK (type IN ('ORDER', 'APPOINTMENT', 'CANCELLATION', 'RESCHEDULE', 'LOW_INVENTORY', 'SUBSCRIPTION', 'PROMOTION', 'SYSTEM'));

-- 3. Recipient-aware index for efficient notification listing and unread badge counts
CREATE INDEX IF NOT EXISTS business_notifications_tenant_recipient_idx
  ON public.business_notifications (tenant_id, recipient_id, is_read, created_at DESC);

-- 4. Update RLS policies: recipient-aware read, update, and new delete policy
DROP POLICY IF EXISTS business_notifications_member_read ON public.business_notifications;
CREATE POLICY business_notifications_member_read ON public.business_notifications
  FOR SELECT TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id)
    AND (recipient_id IS NULL OR recipient_id = auth.uid())
  );

DROP POLICY IF EXISTS business_notifications_member_update ON public.business_notifications;
CREATE POLICY business_notifications_member_update ON public.business_notifications
  FOR UPDATE TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id)
    AND (recipient_id IS NULL OR recipient_id = auth.uid())
  )
  WITH CHECK (
    public.user_has_tenant_access(tenant_id)
    AND (recipient_id IS NULL OR recipient_id = auth.uid())
  );

-- Enable individual notification dismissal (delete)
DROP POLICY IF EXISTS business_notifications_member_delete ON public.business_notifications;
CREATE POLICY business_notifications_member_delete ON public.business_notifications
  FOR DELETE TO authenticated
  USING (
    public.user_has_tenant_access(tenant_id)
    AND (recipient_id IS NULL OR recipient_id = auth.uid())
  );

GRANT DELETE ON TABLE public.business_notifications TO authenticated;

-- 5. Trigger for appointment reschedules (date or time changes without cancellation)
CREATE OR REPLACE FUNCTION public.enqueue_appointment_reschedule_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_status TEXT := UPPER(COALESCE(NEW.status, ''));
  v_date_changed BOOLEAN;
BEGIN
  IF v_status = 'CANCELLED' THEN
    RETURN NEW;
  END IF;

  v_date_changed := (OLD.starts_at IS DISTINCT FROM NEW.starts_at)
    OR (OLD.appointment_date IS DISTINCT FROM NEW.appointment_date)
    OR (OLD.appointment_time IS DISTINCT FROM NEW.appointment_time);

  IF v_date_changed AND TG_OP = 'UPDATE' THEN
    INSERT INTO public.business_notifications
      (tenant_id, type, title, message, source_table, source_id, event_key, href)
    VALUES (
      NEW.tenant_id,
      'RESCHEDULE',
      'Appointment rescheduled',
      COALESCE(NEW.customer_name, 'A customer') || '''s appointment was moved to ' ||
        COALESCE(NEW.appointment_date::TEXT, TO_CHAR(NEW.starts_at, 'YYYY-MM-DD')) || ' ' ||
        COALESCE(SUBSTRING(NEW.appointment_time::TEXT FROM 1 FOR 5), TO_CHAR(NEW.starts_at, 'HH24:MI')) || '.',
      'appointments',
      NEW.id,
      'RESCHEDULED_' || COALESCE(NEW.starts_at::TEXT, (NEW.appointment_date::TEXT || '_' || NEW.appointment_time::TEXT)),
      '/dashboard/appointments'
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_appointment_reschedule_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_appointment_reschedule_notification ON public.appointments;
CREATE TRIGGER trg_appointment_reschedule_notification
AFTER UPDATE OF starts_at, appointment_date, appointment_time ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_appointment_reschedule_notification();

-- 6. Trigger for subscription and trial updates targeting the business owner
CREATE OR REPLACE FUNCTION public.enqueue_subscription_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_owner_id UUID;
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

  SELECT membership.profile_id INTO v_owner_id
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id AND role.tenant_id = membership.tenant_id
  WHERE membership.tenant_id = NEW.id
    AND membership.is_active = TRUE
    AND UPPER(role.name) = 'OWNER'
  ORDER BY membership.joined_at
  LIMIT 1;

  IF v_new_status = 'active' AND v_old_status <> 'active' THEN
    v_title := 'Subscription active';
    v_message := 'Your ' || UPPER(COALESCE(NEW.plan, 'Starter')) || ' subscription is now active.';
    v_event_key := 'SUB_ACTIVE_' || COALESCE(NEW.plan, 'starter');
  ELSIF v_new_status IN ('past_due', 'cancelled') AND v_old_status <> v_new_status THEN
    v_title := 'Subscription ' || REPLACE(v_new_status, '_', ' ');
    v_message := 'Action required: Your subscription status is ' || REPLACE(v_new_status, '_', ' ') || '.';
    v_event_key := 'SUB_ISSUE_' || v_new_status;
  ELSIF NEW.plan IS DISTINCT FROM OLD.plan THEN
    v_title := 'Plan updated';
    v_message := 'Your plan has been updated to ' || UPPER(COALESCE(NEW.plan, 'Starter')) || '.';
    v_event_key := 'PLAN_' || COALESCE(NEW.plan, 'starter') || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  ELSE
    v_title := 'Subscription updated';
    v_message := 'Your subscription details were updated.';
    v_event_key := 'SUB_UPDATED_' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT;
  END IF;

  INSERT INTO public.business_notifications
    (tenant_id, recipient_id, type, title, message, source_table, source_id, event_key, href)
  VALUES
    (NEW.id, v_owner_id, 'SUBSCRIPTION', v_title, v_message, 'tenants', NEW.id, v_event_key, '/dashboard/settings')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_subscription_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_subscription_change_notification ON public.tenants;
CREATE TRIGGER trg_subscription_change_notification
AFTER UPDATE OF plan, subscription_status, trial_ends_at ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.enqueue_subscription_notification();

-- 7. Trigger for new promotions created
CREATE OR REPLACE FUNCTION public.enqueue_promotion_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.business_notifications
    (tenant_id, type, title, message, source_table, source_id, event_key, href)
  VALUES (
    NEW.tenant_id,
    'PROMOTION',
    'Promotion created',
    'Promo code ' || UPPER(NEW.code) || ' is now active (' || NEW.discount_value || CASE WHEN NEW.discount_type = 'percentage' THEN '% off' ELSE ' off' END || ').',
    'promotions',
    NEW.id,
    'PROMO_CREATED',
    '/dashboard/tools'
  ) ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_promotion_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_promotion_created_notification ON public.promotions;
CREATE TRIGGER trg_promotion_created_notification
AFTER INSERT ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.enqueue_promotion_notification();

-- 8. Avoid duplicate transactional email for tenants table since
-- trg_enqueue_subscription_transactional_email already handles tenant updates.
CREATE OR REPLACE FUNCTION public.enqueue_business_alert_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner RECORD; v_tenant public.tenants%ROWTYPE;
BEGIN
  IF NEW.source_table IN ('storefront_contact_messages', 'tenants') THEN RETURN NEW; END IF;
  SELECT * INTO v_owner FROM public.transactional_email_owner(NEW.tenant_id);
  SELECT * INTO v_tenant FROM public.tenants WHERE id=NEW.tenant_id;
  IF v_owner.email IS NULL THEN RETURN NEW; END IF;
  BEGIN
    INSERT INTO public.transactional_email_deliveries (
      tenant_id,event_type,source_table,source_id,recipient_email,recipient_name,subject,payload,idempotency_key
    ) VALUES (
      NEW.tenant_id,'BUSINESS_ALERT','business_notifications',NEW.id,LOWER(v_owner.email),
      v_owner.full_name,NEW.title,JSONB_BUILD_OBJECT('business_name',v_tenant.business_name,
        'title',NEW.title,'message',NEW.message,'href',NEW.href,'notification_type',NEW.type),
      'business-alert/' || NEW.id::TEXT
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'In-app notification saved but email enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_business_alert_email() FROM PUBLIC, anon, authenticated;

-- 9. Ensure business_notifications is in supabase_realtime publication
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='business_notifications') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.business_notifications;
    END IF;
  END IF;
END;
$$;

COMMIT;

