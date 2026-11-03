BEGIN;

-- Customer email policy
--
-- Appointment businesses:
--   * booking received
--   * tracking verification code (sent directly by the protected API)
--   * appointment confirmed or cancelled
--
-- Ordering businesses:
--   * order received
--   * tracking verification code (sent directly by the protected API)
--   * order ready or cancelled
--
-- Retail businesses:
--   * order received
--   * tracking verification code (sent directly by the protected API)
--   * payment confirmed

-- Receipt approval is an internal reconciliation action for appointments.
-- It updates the tracker but must not send a separate customer email.
DROP TRIGGER IF EXISTS trg_enqueue_appointment_payment_confirmed_email
  ON public.appointments;

UPDATE public.appointment_email_deliveries
SET
  status = 'CANCELLED',
  last_error = 'Suppressed by the appointment customer email policy.',
  processing_started_at = NULL,
  updated_at = NOW()
WHERE event_type = 'APPOINTMENT_PAYMENT_CONFIRMED'
  AND status IN ('PENDING', 'FAILED');

-- Appointment reminder emails are outside the requested customer email set.
DROP TRIGGER IF EXISTS trg_schedule_appointment_reminders
  ON public.appointments;

UPDATE public.appointment_reminders
SET
  status = 'CANCELLED',
  last_error = 'Suppressed by the appointment customer email policy.',
  updated_at = NOW()
WHERE status IN ('PENDING', 'FAILED');

UPDATE public.business_settings AS settings
SET appointment_reminders_enabled = FALSE
FROM public.tenants AS tenant
WHERE tenant.id = settings.tenant_id
  AND LOWER(COALESCE(tenant.business_type, '')) = 'appointment'
  AND settings.appointment_reminders_enabled = TRUE;

-- Status changes remain visible in the customer tracker. Ordering customers
-- receive a status email only when the order is ready or is cancelled.
CREATE OR REPLACE FUNCTION public.enqueue_order_status_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event TEXT;
  v_tenant public.tenants%ROWTYPE;
  v_items JSONB;
  v_subject TEXT;
BEGIN
  IF TG_OP <> 'UPDATE'
     OR NEW.status IS NOT DISTINCT FROM OLD.status
     OR NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO v_tenant
  FROM public.tenants AS tenant
  WHERE tenant.id = NEW.tenant_id;

  IF LOWER(COALESCE(v_tenant.business_type, '')) <> 'ordering' THEN
    RETURN NEW;
  END IF;

  v_event := CASE UPPER(COALESCE(NEW.status, ''))
    WHEN 'READY' THEN 'ORDER_READY'
    WHEN 'CANCELLED' THEN 'ORDER_CANCELLED'
    ELSE NULL
  END;

  IF v_event IS NULL THEN
    RETURN NEW;
  END IF;

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
  FROM public.order_items AS item
  WHERE item.order_id = NEW.id
    AND item.tenant_id = NEW.tenant_id;

  v_subject := CASE v_event
    WHEN 'ORDER_READY' THEN 'Order ready - ' || NEW.order_number
    ELSE 'Order cancelled - ' || NEW.order_number
  END;

  BEGIN
    INSERT INTO public.order_email_deliveries (
      tenant_id,
      order_id,
      event_type,
      recipient_email,
      recipient_name,
      subject,
      payload
    ) VALUES (
      NEW.tenant_id,
      NEW.id,
      v_event,
      LOWER(BTRIM(NEW.customer_email)),
      COALESCE(NULLIF(BTRIM(NEW.customer_name), ''), 'Customer'),
      v_subject,
      JSONB_BUILD_OBJECT(
        'business_name', v_tenant.business_name,
        'business_email', v_tenant.email,
        'business_phone', v_tenant.phone,
        'storefront_slug', v_tenant.slug,
        'order_number', NEW.order_number,
        'order_type', NEW.order_type,
        'payment_status', NEW.payment_status,
        'total', NEW.total,
        'cancellation_reason', NEW.cancellation_reason,
        'items', v_items
      )
    )
    ON CONFLICT (order_id, event_type) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Order status saved but customer email enqueue failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_status_email()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enqueue_order_status_email ON public.orders;
CREATE TRIGGER trg_enqueue_order_status_email
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_order_status_email();

-- Only retail payment approval sends PAYMENT_CONFIRMED. Ordering payment
-- approval is shown in tracking and the owner later sends the ready/cancelled
-- outcome through the order status workflow.
CREATE OR REPLACE FUNCTION public.enqueue_order_payment_confirmed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_name TEXT;
  v_business_type TEXT;
  v_storefront_slug TEXT;
  v_items JSONB;
BEGIN
  IF UPPER(COALESCE(NEW.payment_status, '')) <> 'PAID'
    OR UPPER(COALESCE(OLD.payment_status, '')) = 'PAID'
    OR NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT tenant.business_name, tenant.business_type, tenant.slug
  INTO v_business_name, v_business_type, v_storefront_slug
  FROM public.tenants AS tenant
  WHERE tenant.id = NEW.tenant_id;

  IF LOWER(COALESCE(v_business_type, '')) <> 'retail' THEN
    RETURN NEW;
  END IF;

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
  FROM public.order_items AS item
  WHERE item.order_id = NEW.id
    AND item.tenant_id = NEW.tenant_id;

  INSERT INTO public.order_email_deliveries (
    tenant_id,
    order_id,
    event_type,
    recipient_email,
    recipient_name,
    subject,
    payload
  ) VALUES (
    NEW.tenant_id,
    NEW.id,
    'PAYMENT_CONFIRMED',
    LOWER(BTRIM(NEW.customer_email)),
    COALESCE(NULLIF(BTRIM(NEW.customer_name), ''), 'Customer'),
    'Payment confirmed for order ' || NEW.order_number,
    JSONB_BUILD_OBJECT(
      'business_name', COALESCE(NULLIF(v_business_name, ''), 'YuhBusiness'),
      'storefront_slug', v_storefront_slug,
      'order_number', NEW.order_number,
      'created_at', NEW.created_at,
      'order_type', NEW.order_type,
      'requested_time', NEW.requested_time,
      'delivery_address', NEW.delivery_address,
      'delivery_area', NEW.delivery_area,
      'payment_status', NEW.payment_status,
      'fulfillment_status', NEW.fulfillment_status,
      'amount_paid', NEW.amount_paid,
      'total', NEW.total,
      'items', v_items
    )
  )
  ON CONFLICT (order_id, event_type) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_order_payment_confirmed_email()
  FROM PUBLIC, anon, authenticated;

-- Cancel unsent messages that are no longer part of each business type's
-- customer email policy. Sent history is retained for audit purposes.
UPDATE public.order_email_deliveries AS delivery
SET
  status = 'CANCELLED',
  last_error = 'Suppressed by the customer email policy.',
  processing_started_at = NULL,
  updated_at = NOW()
FROM public.tenants AS tenant
WHERE tenant.id = delivery.tenant_id
  AND delivery.status IN ('PENDING', 'FAILED')
  AND (
    (
      LOWER(COALESCE(tenant.business_type, '')) = 'retail'
      AND delivery.event_type IN (
        'ORDER_ACCEPTED',
        'ORDER_PREPARING',
        'ORDER_READY',
        'ORDER_OUT_FOR_DELIVERY',
        'ORDER_COMPLETED',
        'ORDER_CANCELLED'
      )
    )
    OR (
      LOWER(COALESCE(tenant.business_type, '')) = 'ordering'
      AND delivery.event_type IN (
        'PAYMENT_CONFIRMED',
        'ORDER_ACCEPTED',
        'ORDER_PREPARING',
        'ORDER_OUT_FOR_DELIVERY',
        'ORDER_COMPLETED'
      )
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
