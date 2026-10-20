-- Subscription checkout is still prelaunch. Repair any paid-looking tenant
-- without a verified Belize Bank settlement and remove the false activation
-- notification produced by development mock checkout.
BEGIN;

CREATE TEMP TABLE _unverified_subscription_tenants (
  tenant_id UUID PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO _unverified_subscription_tenants (tenant_id)
SELECT tenant.id
FROM public.tenants tenant
WHERE LOWER(COALESCE(tenant.subscription_status, 'trial')) IN (
    'active',
    'cancelled',
    'canceled'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.payment_transactions payment
    WHERE payment.tenant_id = tenant.id
      AND UPPER(payment.kind) = 'SUBSCRIPTION'
      AND UPPER(payment.provider) = 'BELIZE_BANK'
      AND UPPER(payment.status) IN ('SUCCEEDED', 'PARTIALLY_REFUNDED')
      AND payment.paid_at IS NOT NULL
  );

UPDATE public.payment_transactions payment
SET status = 'FAILED',
    paid_at = NULL,
    metadata = COALESCE(payment.metadata, '{}'::JSONB) || JSONB_BUILD_OBJECT(
      'prelaunch_test', TRUE,
      'prelaunch_note', 'No verified Belize Bank payment was collected.'
    ),
    updated_at = NOW()
WHERE payment.tenant_id IN (
    SELECT tenant_id FROM _unverified_subscription_tenants
  )
  AND UPPER(payment.kind) = 'SUBSCRIPTION';

UPDATE public.subscription_invoices invoice
SET status = 'VOID',
    paid_at = NULL,
    updated_at = NOW()
WHERE invoice.tenant_id IN (
    SELECT tenant_id FROM _unverified_subscription_tenants
  )
  AND invoice.status <> 'VOID';

DELETE FROM public.business_notifications notification
WHERE notification.tenant_id IN (
    SELECT tenant_id FROM _unverified_subscription_tenants
  )
  AND notification.type = 'SUBSCRIPTION'
  AND notification.title = 'Subscription active';

UPDATE public.tenants tenant
SET subscription_status = 'trial',
    trial_ends_at = COALESCE(
      tenant.trial_ends_at,
      tenant.created_at + INTERVAL '14 days'
    ),
    current_period_start = NULL,
    current_period_end = NULL,
    cancel_at_period_end = FALSE,
    canceled_at = NULL,
    provider_customer_id = NULL,
    provider_subscription_id = NULL,
    subscription_base_amount = 0,
    subscription_seat_amount = 0,
    subscription_recurring_total = 0,
    subscription_paid_staff_seats = 0,
    subscription_updated_at = NOW(),
    updated_at = NOW()
WHERE tenant.id IN (
  SELECT tenant_id FROM _unverified_subscription_tenants
);

UPDATE public.tenant_seat_entitlements entitlement
SET paid_staff_seats = 0,
    updated_at = NOW()
WHERE entitlement.tenant_id IN (
  SELECT tenant_id FROM _unverified_subscription_tenants
);

NOTIFY pgrst, 'reload schema';

COMMIT;
