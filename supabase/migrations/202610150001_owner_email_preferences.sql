BEGIN;

-- Owner-facing operational email is configurable per business. Customer
-- receipts, appointment confirmations, reminders, and cancellations remain
-- transactional and are intentionally not controlled by these preferences.
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS owner_email_appointments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS owner_email_orders BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS owner_email_retail_orders BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS owner_email_contact_messages BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS owner_email_other_alerts BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF TO_REGCLASS('public.business_notifications') IS NULL
     OR TO_REGPROC('public.notify_tenant_members') IS NULL
     OR NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'business_notifications'
         AND column_name = 'recipient_id'
     ) THEN
    RAISE EXCEPTION
      'Apply 202609060002_recipient_realtime_notifications.sql before this migration.';
  END IF;
END;
$$;

-- Fan-out creates one in-app notification per active tenant member. Queue the
-- owner email only from the selected owner's row so a larger team cannot cause
-- duplicate owner messages for one business event.
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
  IF NEW.source_table = 'storefront_contact_messages' THEN
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

  SELECT
    settings.owner_email_appointments,
    settings.owner_email_orders,
    settings.owner_email_retail_orders,
    settings.owner_email_other_alerts
  INTO
    v_email_appointments,
    v_email_orders,
    v_email_retail_orders,
    v_email_other_alerts
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

  BEGIN
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
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'In-app notification saved but email enqueue failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_business_alert_email()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_business_alert_email
  ON public.business_notifications;
CREATE TRIGGER trg_enqueue_business_alert_email
AFTER INSERT ON public.business_notifications
FOR EACH ROW EXECUTE FUNCTION public.enqueue_business_alert_email();

-- Give retail orders clear payment-aware wording. "Marked paid" is deliberate:
-- the current mock-card flow does not represent settled real-world funds.
CREATE OR REPLACE FUNCTION public.enqueue_business_activity_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status TEXT := UPPER(COALESCE(NEW.status, ''));
  v_old_status TEXT;
  v_changed BOOLEAN := FALSE;
  v_business_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    v_old_status := UPPER(COALESCE(OLD.status, ''));
  END IF;

  BEGIN
    IF TG_TABLE_NAME = 'orders' THEN
      IF TG_OP = 'INSERT' THEN
        SELECT LOWER(COALESCE(tenant.business_type, ''))
        INTO v_business_type
        FROM public.tenants tenant
        WHERE tenant.id = NEW.tenant_id;

        IF v_business_type = 'retail' THEN
          IF UPPER(COALESCE(NEW.payment_status, 'UNPAID')) = 'PAID' THEN
            v_title := 'New retail order marked paid';
            v_message := 'Retail order ' || COALESCE(NEW.order_number, '') ||
              ' was placed by ' || COALESCE(NEW.customer_name, 'a customer') ||
              ' and is marked paid.';
          ELSE
            v_title := 'New retail order - payment pending';
            v_message := 'Retail order ' || COALESCE(NEW.order_number, '') ||
              ' was placed by ' || COALESCE(NEW.customer_name, 'a customer') ||
              '. Payment is due later.';
          END IF;
        ELSE
          v_title := 'New order';
          v_message := 'Order ' || COALESCE(NEW.order_number, '') ||
            ' was placed by ' || COALESCE(NEW.customer_name, 'a customer') || '.';
        END IF;

        PERFORM public.notify_tenant_members(
          NEW.tenant_id, 'ORDER', v_title, v_message,
          'orders', NEW.id, 'CREATED',
          '/dashboard/orders?order=' || NEW.id::TEXT, 'ALL',
          JSONB_BUILD_OBJECT(
            'order_id', NEW.id,
            'customer_id', NEW.customer_id,
            'payment_status', NEW.payment_status,
            'business_type', v_business_type
          )
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
            'RESCHEDULED_' || COALESCE(
              NEW.starts_at::TEXT,
              NEW.appointment_date::TEXT || '_' || NEW.appointment_time::TEXT
            ),
            '/dashboard/appointments?appointment=' || NEW.id::TEXT, 'ALL',
            JSONB_BUILD_OBJECT(
              'appointment_id', NEW.id,
              'customer_id', NEW.customer_id,
              'starts_at', NEW.starts_at
            )
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

-- Customer receipts use the same order queue but now explain whether a retail
-- order is marked paid or still due. The existing triggers continue to call
-- this replaced function.
CREATE OR REPLACE FUNCTION public.enqueue_order_received_after_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_items JSONB;
  v_subject TEXT;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NULLIF(BTRIM(COALESCE(OLD.customer_email, '')), '') IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NULL
     OR UPPER(COALESCE(NEW.status, '')) <> 'PENDING' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'name', item.product_name,
        'quantity', item.quantity,
        'unit_price', item.unit_price,
        'subtotal', item.subtotal
      ) ORDER BY item.created_at
    ),
    '[]'::JSONB
  )
  INTO v_items
  FROM public.order_items item
  WHERE item.order_id = NEW.id;

  IF LOWER(COALESCE(v_tenant.business_type, '')) = 'retail' THEN
    v_subject := CASE
      WHEN UPPER(COALESCE(NEW.payment_status, 'UNPAID')) = 'PAID'
        THEN 'Retail order ' || NEW.order_number || ' is marked paid'
      ELSE 'Retail order ' || NEW.order_number || ' received - payment pending'
    END;
  ELSE
    v_subject := 'We received order ' || NEW.order_number;
  END IF;

  BEGIN
    INSERT INTO public.order_email_deliveries (
      tenant_id, order_id, event_type, recipient_email, recipient_name,
      subject, payload
    ) VALUES (
      NEW.tenant_id, NEW.id, 'ORDER_RECEIVED', LOWER(NEW.customer_email),
      COALESCE(NULLIF(BTRIM(NEW.customer_name), ''), 'Customer'), v_subject,
      JSONB_BUILD_OBJECT(
        'business_name', v_tenant.business_name,
        'business_email', v_tenant.email,
        'business_phone', v_tenant.phone,
        'business_type', v_tenant.business_type,
        'order_number', NEW.order_number,
        'order_type', NEW.order_type,
        'payment_status', NEW.payment_status,
        'total', NEW.total,
        'items', v_items
      )
    )
    ON CONFLICT (order_id, event_type) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Order saved but confirmation email enqueue failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_received_after_email()
  FROM PUBLIC, anon, authenticated;

-- Retail checkout creates its base order as UNPAID and, for mock-card checkout,
-- marks it PAID later in the same transaction. Refresh still-pending email and
-- in-app rows when that transition happens so delivery reflects the committed
-- payment status instead of the earlier insert snapshot.
CREATE OR REPLACE FUNCTION public.refresh_retail_order_payment_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_items JSONB;
  v_title TEXT;
  v_message TEXT;
  v_customer_subject TEXT;
BEGIN
  IF NEW.payment_status IS NOT DISTINCT FROM OLD.payment_status THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants tenant
  WHERE tenant.id = NEW.tenant_id
    AND LOWER(COALESCE(tenant.business_type, '')) = 'retail';
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF UPPER(COALESCE(NEW.payment_status, 'UNPAID')) = 'PAID' THEN
    v_title := 'New retail order marked paid';
    v_message := 'Retail order ' || COALESCE(NEW.order_number, '') ||
      ' was placed by ' || COALESCE(NEW.customer_name, 'a customer') ||
      ' and is marked paid.';
    v_customer_subject := 'Retail order ' || NEW.order_number || ' is marked paid';
  ELSE
    v_title := 'New retail order - payment pending';
    v_message := 'Retail order ' || COALESCE(NEW.order_number, '') ||
      ' was placed by ' || COALESCE(NEW.customer_name, 'a customer') ||
      '. Payment is due later.';
    v_customer_subject := 'Retail order ' || NEW.order_number ||
      ' received - payment pending';
  END IF;

  UPDATE public.business_notifications notification
  SET title = v_title,
      message = v_message,
      metadata = COALESCE(notification.metadata, '{}'::JSONB) ||
        JSONB_BUILD_OBJECT('payment_status', NEW.payment_status)
  WHERE notification.tenant_id = NEW.tenant_id
    AND notification.source_table = 'orders'
    AND notification.source_id = NEW.id
    AND notification.event_key = 'CREATED';

  UPDATE public.transactional_email_deliveries delivery
  SET subject = v_title,
      payload = COALESCE(delivery.payload, '{}'::JSONB) ||
        JSONB_BUILD_OBJECT(
          'title', v_title,
          'message', v_message,
          'payment_status', NEW.payment_status
        ),
      updated_at = NOW()
  FROM public.business_notifications notification
  WHERE delivery.tenant_id = NEW.tenant_id
    AND delivery.event_type = 'BUSINESS_ALERT'
    AND delivery.source_table = 'business_notifications'
    AND delivery.source_id = notification.id
    AND delivery.status IN ('PENDING', 'FAILED')
    AND notification.source_table = 'orders'
    AND notification.source_id = NEW.id
    AND notification.event_key = 'CREATED';

  SELECT COALESCE(
    JSONB_AGG(
      JSONB_BUILD_OBJECT(
        'name', item.product_name,
        'quantity', item.quantity,
        'unit_price', item.unit_price,
        'subtotal', item.subtotal
      ) ORDER BY item.created_at
    ),
    '[]'::JSONB
  )
  INTO v_items
  FROM public.order_items item
  WHERE item.order_id = NEW.id;

  IF NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NOT NULL THEN
    INSERT INTO public.order_email_deliveries (
      tenant_id, order_id, event_type, recipient_email, recipient_name,
      subject, payload
    ) VALUES (
      NEW.tenant_id, NEW.id, 'ORDER_RECEIVED', LOWER(NEW.customer_email),
      COALESCE(NULLIF(BTRIM(NEW.customer_name), ''), 'Customer'),
      v_customer_subject,
      JSONB_BUILD_OBJECT(
        'business_name', v_tenant.business_name,
        'business_email', v_tenant.email,
        'business_phone', v_tenant.phone,
        'business_type', v_tenant.business_type,
        'order_number', NEW.order_number,
        'order_type', NEW.order_type,
        'payment_status', NEW.payment_status,
        'total', NEW.total,
        'items', v_items
      )
    )
    ON CONFLICT (order_id, event_type) DO UPDATE
      SET recipient_email = EXCLUDED.recipient_email,
          recipient_name = EXCLUDED.recipient_name,
          subject = EXCLUDED.subject,
          payload = EXCLUDED.payload
      WHERE order_email_deliveries.status IN ('PENDING', 'FAILED');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_retail_order_payment_notifications()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_refresh_retail_order_payment_notifications
  ON public.orders;
CREATE TRIGGER trg_refresh_retail_order_payment_notifications
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.refresh_retail_order_payment_notifications();

-- Keep storefront messages durable even when their email channel is disabled.
CREATE OR REPLACE FUNCTION public.submit_storefront_contact_message(
  p_tenant_id UUID,
  p_sender_name TEXT,
  p_sender_email TEXT,
  p_subject TEXT,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_message_id UUID;
  v_email_enabled BOOLEAN := TRUE;
  v_name TEXT := BTRIM(COALESCE(p_sender_name, ''));
  v_email TEXT := LOWER(BTRIM(COALESCE(p_sender_email, '')));
  v_subject TEXT := BTRIM(COALESCE(p_subject, ''));
  v_body TEXT := BTRIM(COALESCE(p_message, ''));
BEGIN
  IF LENGTH(v_name) < 2 OR LENGTH(v_name) > 120 THEN
    RAISE EXCEPTION 'Enter a valid name.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(v_email) > 254
     OR v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(v_subject) > 160 OR LENGTH(v_body) < 2 OR LENGTH(v_body) > 5000 THEN
    RAISE EXCEPTION 'Enter a message between 2 and 5000 characters.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tenant
  FROM public.tenants tenant
  WHERE tenant.id = p_tenant_id
    AND tenant.is_active = TRUE
    AND UPPER(tenant.status) = 'ACTIVE'
    AND NULLIF(BTRIM(tenant.email), '') IS NOT NULL
    AND public.growth_tools_subscription_allows_access(tenant.id)
    AND (
      LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
      OR LOWER(COALESCE(tenant.plan, 'starter')) IN ('pro', 'enterprise')
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This business is not accepting storefront messages.' USING ERRCODE = 'P0001';
  END IF;

  SELECT settings.owner_email_contact_messages
  INTO v_email_enabled
  FROM public.business_settings settings
  WHERE settings.tenant_id = p_tenant_id;

  IF (
    SELECT COUNT(*)
    FROM public.storefront_contact_messages contact
    WHERE contact.tenant_id = p_tenant_id
      AND contact.sender_email = v_email
      AND contact.created_at > NOW() - INTERVAL '15 minutes'
  ) >= 5 THEN
    RAISE EXCEPTION 'Too many messages were submitted. Please try again later.' USING ERRCODE = 'P0001';
  END IF;

  IF v_subject = '' THEN
    v_subject := 'Storefront message from ' || v_name;
  END IF;

  INSERT INTO public.storefront_contact_messages (
    tenant_id, sender_name, sender_email, subject, message
  ) VALUES (
    p_tenant_id, v_name, v_email, v_subject, v_body
  )
  RETURNING id INTO v_message_id;

  BEGIN
    IF COALESCE(v_email_enabled, TRUE) THEN
      INSERT INTO public.transactional_email_deliveries (
        tenant_id, event_type, source_table, source_id, recipient_email,
        recipient_name, subject, payload, idempotency_key
      ) VALUES (
        p_tenant_id, 'CONTACT_FORM_MESSAGE', 'storefront_contact_messages',
        v_message_id, LOWER(v_tenant.email), v_tenant.business_name, v_subject,
        JSONB_BUILD_OBJECT(
          'business_name', v_tenant.business_name,
          'sender_email', v_email,
          'message_subject', v_subject,
          'message', v_body
        ),
        'contact/' || v_message_id::TEXT
      );
    END IF;

    INSERT INTO public.business_notifications (
      tenant_id, type, title, message, source_table, source_id, event_key, href
    ) VALUES (
      p_tenant_id, 'SYSTEM', 'New storefront message',
      v_name || ' sent a contact message.', 'storefront_contact_messages',
      v_message_id, 'CONTACT_MESSAGE', '/dashboard/customers'
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Contact message % saved but notification enqueue failed: %',
      v_message_id, SQLERRM;
  END;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_storefront_contact_message(
  UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_storefront_contact_message(
  UUID, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;

COMMIT;
