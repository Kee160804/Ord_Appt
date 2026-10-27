BEGIN;

-- Customer payment confirmation is an order event delivered by the same
-- transactional Resend queue as the order-received message.
ALTER TABLE public.order_email_deliveries
  DROP CONSTRAINT IF EXISTS order_email_deliveries_event_type_check;

ALTER TABLE public.order_email_deliveries
  ADD CONSTRAINT order_email_deliveries_event_type_check
  CHECK (event_type IN (
    'ORDER_RECEIVED',
    'ORDER_ACCEPTED',
    'ORDER_PREPARING',
    'ORDER_READY',
    'ORDER_OUT_FOR_DELIVERY',
    'ORDER_COMPLETED',
    'ORDER_CANCELLED',
    'ORDER_EMAIL_VERIFICATION',
    'PAYMENT_CONFIRMED'
  ));

CREATE OR REPLACE FUNCTION public.enqueue_order_payment_confirmed_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_business_name TEXT;
  v_storefront_slug TEXT;
  v_items JSONB;
BEGIN
  IF UPPER(COALESCE(NEW.payment_status, '')) <> 'PAID'
    OR UPPER(COALESCE(OLD.payment_status, '')) = 'PAID'
    OR NULLIF(BTRIM(COALESCE(NEW.customer_email, '')), '') IS NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT tenant.business_name, tenant.slug
  INTO v_business_name, v_storefront_slug
  FROM public.tenants AS tenant
  WHERE tenant.id = NEW.tenant_id;

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

DROP TRIGGER IF EXISTS trg_enqueue_order_payment_confirmed_email
  ON public.orders;

CREATE TRIGGER trg_enqueue_order_payment_confirmed_email
AFTER UPDATE OF payment_status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_order_payment_confirmed_email();

NOTIFY pgrst, 'reload schema';

COMMIT;
