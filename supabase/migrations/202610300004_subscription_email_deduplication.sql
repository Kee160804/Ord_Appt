BEGIN;

-- Subscription owner email policy:
--   * trial and paid-plan expiration reminders are queued at most once per end date;
--   * successful renewals, activations, plan changes and payment issues are queued
--     only when the corresponding subscription state actually changes;
--   * the generic business-alert channel must not duplicate subscription mail.

ALTER TABLE public.transactional_email_deliveries
  DROP CONSTRAINT IF EXISTS transactional_email_deliveries_event_type_check;
ALTER TABLE public.transactional_email_deliveries
  ADD CONSTRAINT transactional_email_deliveries_event_type_check
  CHECK (event_type IN (
    'WELCOME_ACCOUNT', 'BUSINESS_CREATED', 'TEAM_INVITATION',
    'APPOINTMENT_CANCELLED', 'CONTACT_FORM_MESSAGE',
    'TRIAL_EXPIRING', 'TRIAL_EXPIRED', 'SUBSCRIPTION_ACTIVATED',
    'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_PAYMENT_ISSUE',
    'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_EXPIRING', 'BUSINESS_ALERT'
  ));

CREATE OR REPLACE FUNCTION public.enqueue_subscription_transactional_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner RECORD;
  v_event TEXT;
  v_subject TEXT;
  v_idempotency_key TEXT;
  v_old_status TEXT := LOWER(COALESCE(OLD.subscription_status, 'trial'));
  v_new_status TEXT := LOWER(COALESCE(NEW.subscription_status, 'trial'));
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NEW.plan IS NOT DISTINCT FROM OLD.plan
     AND NEW.subscription_status IS NOT DISTINCT FROM OLD.subscription_status
     AND NEW.trial_ends_at IS NOT DISTINCT FROM OLD.trial_ends_at
     AND NEW.current_period_start IS NOT DISTINCT FROM OLD.current_period_start
     AND NEW.current_period_end IS NOT DISTINCT FROM OLD.current_period_end
     AND NEW.cancel_at_period_end IS NOT DISTINCT FROM OLD.cancel_at_period_end THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_owner FROM public.transactional_email_owner(NEW.id);
  IF v_owner.email IS NULL THEN
    RETURN NEW;
  END IF;

  -- A later paid-through date while active means a successful renewal, even
  -- when the plan itself also changed in that same transaction.
  IF v_new_status = 'active'
     AND NEW.current_period_end IS NOT NULL
      AND OLD.current_period_end IS NOT NULL
      AND NEW.current_period_end > OLD.current_period_end THEN
    v_event := 'SUBSCRIPTION_RENEWED';
    v_subject := NEW.business_name || ' subscription renewed';
    v_idempotency_key := 'subscription-renewed/' || NEW.id::TEXT || '/'
      || TO_CHAR(NEW.current_period_end AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS');
  ELSIF v_new_status = 'active' AND v_old_status <> 'active' THEN
    v_event := 'SUBSCRIPTION_ACTIVATED';
    v_subject := NEW.business_name || ' subscription activated';
    v_idempotency_key := 'subscription-activated/' || NEW.id::TEXT || '/'
      || COALESCE(NEW.current_period_end::TEXT, NEW.updated_at::TEXT, CLOCK_TIMESTAMP()::TEXT);
  ELSIF v_new_status IN ('past_due', 'cancelled', 'canceled')
        AND v_new_status IS DISTINCT FROM v_old_status THEN
    v_event := 'SUBSCRIPTION_PAYMENT_ISSUE';
    v_subject := NEW.business_name || ' subscription ' || REPLACE(v_new_status, '_', ' ');
    v_idempotency_key := 'subscription-issue/' || NEW.id::TEXT || '/'
      || v_new_status || '/' || COALESCE(NEW.updated_at::TEXT, CLOCK_TIMESTAMP()::TEXT);
  ELSE
    v_event := 'SUBSCRIPTION_UPDATED';
    v_subject := NEW.business_name || ' subscription updated';
    v_idempotency_key := 'subscription-updated/' || NEW.id::TEXT || '/'
      || MD5(CONCAT_WS('|', OLD.plan, NEW.plan, OLD.subscription_status,
        NEW.subscription_status, OLD.trial_ends_at::TEXT, NEW.trial_ends_at::TEXT,
        OLD.cancel_at_period_end::TEXT, NEW.cancel_at_period_end::TEXT)) || '/'
      || COALESCE(NEW.updated_at::TEXT, CLOCK_TIMESTAMP()::TEXT);
  END IF;

  INSERT INTO public.transactional_email_deliveries (
    tenant_id, event_type, source_table, source_id, recipient_email,
    recipient_name, subject, payload, idempotency_key
  ) VALUES (
    NEW.id, v_event, 'tenants', NEW.id, LOWER(v_owner.email), v_owner.full_name,
    v_subject,
    JSONB_BUILD_OBJECT(
      'business_name', NEW.business_name,
      'plan', NEW.plan,
      'subscription_status', NEW.subscription_status,
      'trial_ends_at', NEW.trial_ends_at,
      'current_period_end', NEW.current_period_end,
      'cancel_at_period_end', NEW.cancel_at_period_end
    ),
    v_idempotency_key
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_subscription_transactional_email()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_subscription_transactional_email
  ON public.tenants;
CREATE TRIGGER trg_enqueue_subscription_transactional_email
AFTER UPDATE OF plan, subscription_status, trial_ends_at,
  current_period_start, current_period_end, cancel_at_period_end
ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_subscription_transactional_email();

-- The central subscription trigger above owns subscription email. Keep the
-- corresponding in-app notifications, but don't send them a second time via
-- the generic BUSINESS_ALERT email path.
CREATE OR REPLACE FUNCTION public.enqueue_business_alert_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner RECORD;
  v_owner_id UUID;
  v_tenant public.tenants%ROWTYPE;
  v_email_appointments BOOLEAN := TRUE;
  v_email_orders BOOLEAN := TRUE;
  v_email_retail_orders BOOLEAN := TRUE;
  v_email_other_alerts BOOLEAN := TRUE;
BEGIN
  IF NEW.source_table IN ('storefront_contact_messages', 'tenants') THEN
    RETURN NEW;
  END IF;

  SELECT membership.profile_id
  INTO v_owner_id
  FROM public.tenant_memberships membership
  JOIN public.roles role
    ON role.id = membership.role_id
   AND role.tenant_id = membership.tenant_id
  JOIN public.profiles profile
    ON profile.id = membership.profile_id
  WHERE membership.tenant_id = NEW.tenant_id
    AND membership.is_active = TRUE
    AND profile.is_active = TRUE
    AND UPPER(role.name) = 'OWNER'
    AND profile.email IS NOT NULL
  ORDER BY membership.joined_at, membership.id
  LIMIT 1;

  IF v_owner_id IS NULL OR NEW.recipient_id IS DISTINCT FROM v_owner_id THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_owner
  FROM public.transactional_email_owner(NEW.tenant_id);
  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  SELECT settings.owner_email_appointments,
         settings.owner_email_orders,
         settings.owner_email_retail_orders,
         settings.owner_email_other_alerts
  INTO v_email_appointments, v_email_orders,
       v_email_retail_orders, v_email_other_alerts
  FROM public.business_settings settings
  WHERE settings.tenant_id = NEW.tenant_id;

  IF v_owner.email IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.source_table = 'appointments'
     AND NOT COALESCE(v_email_appointments, TRUE) THEN
    RETURN NEW;
  ELSIF NEW.source_table = 'orders'
        AND LOWER(COALESCE(v_tenant.business_type, '')) = 'retail'
        AND NOT COALESCE(v_email_retail_orders, TRUE) THEN
    RETURN NEW;
  ELSIF NEW.source_table = 'orders'
        AND LOWER(COALESCE(v_tenant.business_type, '')) <> 'retail'
        AND NOT COALESCE(v_email_orders, TRUE) THEN
    RETURN NEW;
  ELSIF NEW.source_table NOT IN ('appointments', 'orders')
        AND NOT COALESCE(v_email_other_alerts, TRUE) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.transactional_email_deliveries (
    tenant_id, event_type, source_table, source_id, recipient_email,
    recipient_name, subject, payload, idempotency_key
  ) VALUES (
    NEW.tenant_id, 'BUSINESS_ALERT', 'business_notifications', NEW.id,
    LOWER(v_owner.email), v_owner.full_name, NEW.title,
    JSONB_BUILD_OBJECT(
      'business_name', v_tenant.business_name,
      'title', NEW.title,
      'message', NEW.message,
      'href', NEW.href,
      'notification_type', NEW.type
    ),
    'business-alert/' || NEW.id::TEXT
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'In-app notification saved but email enqueue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_business_alert_email()
  FROM PUBLIC, anon, authenticated;

-- Stop already-queued, not-yet-sent duplicate subscription alerts. Sent mail
-- and currently processing jobs are preserved; the migration cannot recall
-- a message already accepted by the provider.
UPDATE public.transactional_email_deliveries delivery
SET status = 'CANCELLED',
    processing_started_at = NULL,
    last_error = 'Duplicate subscription email suppressed; dedicated subscription queue event is authoritative.',
    updated_at = NOW()
FROM public.business_notifications notification
WHERE delivery.event_type = 'BUSINESS_ALERT'
  AND delivery.source_table = 'business_notifications'
  AND delivery.source_id = notification.id
  AND notification.source_table = 'tenants'
  AND UPPER(COALESCE(notification.type, '')) = 'SUBSCRIPTION'
  AND delivery.status IN ('PENDING', 'FAILED');

-- This RPC is called by the existing queue worker. Its stable unique keys mean
-- polling every minute cannot enqueue repeated reminders for the same end date.
CREATE OR REPLACE FUNCTION public.enqueue_due_trial_emails()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row RECORD;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  FOR v_row IN
    SELECT tenant.id,
           tenant.business_name,
           tenant.plan,
           tenant.subscription_status,
           tenant.trial_ends_at,
           tenant.current_period_end,
           tenant.cancel_at_period_end,
           owner.email AS owner_email,
           owner.full_name AS owner_name,
           CASE
             WHEN LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
               AND tenant.trial_ends_at <= NOW()
               THEN 'TRIAL_EXPIRED'
             WHEN LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
               THEN 'TRIAL_EXPIRING'
             ELSE 'SUBSCRIPTION_EXPIRING'
           END AS event_type,
           CASE
             WHEN LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
               AND tenant.trial_ends_at <= NOW()
               THEN tenant.business_name || '''s trial has ended'
             WHEN LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
               THEN tenant.business_name || '''s trial is ending soon'
             ELSE tenant.business_name || ' subscription ends soon'
           END AS subject,
           CASE
             WHEN LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
               AND tenant.trial_ends_at <= NOW()
               THEN 'trial-expired/' || tenant.id::TEXT || '/' || tenant.trial_ends_at::DATE::TEXT
             WHEN LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
               THEN 'trial-expiring/' || tenant.id::TEXT || '/' || tenant.trial_ends_at::DATE::TEXT
             ELSE 'subscription-expiring/' || tenant.id::TEXT || '/' ||
               TO_CHAR(tenant.current_period_end AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS')
           END AS idempotency_key
    FROM public.tenants tenant
    CROSS JOIN LATERAL public.transactional_email_owner(tenant.id) owner
    WHERE (
      LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
      AND tenant.trial_ends_at IS NOT NULL
      AND tenant.trial_ends_at <= NOW() + INTERVAL '3 days'
    ) OR (
      LOWER(COALESCE(tenant.subscription_status, '')) = 'active'
      AND COALESCE(tenant.subscription_recurring_total, 0) > 0
      AND tenant.current_period_end > NOW()
      AND tenant.current_period_end <= NOW() + INTERVAL '3 days'
    )
  LOOP
    INSERT INTO public.transactional_email_deliveries (
      tenant_id, event_type, source_table, source_id, recipient_email,
      recipient_name, subject, payload, idempotency_key
    ) VALUES (
      v_row.id, v_row.event_type, 'tenants', v_row.id,
      LOWER(v_row.owner_email), v_row.owner_name, v_row.subject,
      JSONB_BUILD_OBJECT(
        'business_name', v_row.business_name,
        'plan', v_row.plan,
        'subscription_status', v_row.subscription_status,
        'trial_ends_at', v_row.trial_ends_at,
        'current_period_end', v_row.current_period_end,
        'cancel_at_period_end', v_row.cancel_at_period_end
      ),
      v_row.idempotency_key
    ) ON CONFLICT (idempotency_key) DO NOTHING;

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_due_trial_emails()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_due_trial_emails() TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;