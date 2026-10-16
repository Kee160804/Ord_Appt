-- Mock payments and manual testing overrides must never be treated as paid
-- subscriptions. Restore those tenants to their original trial timeline so an
-- expired trial immediately loses entitlement access.
BEGIN;

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
    subscription_base_amount = 0,
    subscription_seat_amount = 0,
    subscription_recurring_total = 0,
    subscription_updated_at = NOW(),
    updated_at = NOW()
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

-- Subscription changes now go through the protected server route. This closes
-- the old authenticated RPC path that could grant paid access without proof of
-- payment while retaining service-role access for trusted backend operations.
REVOKE EXECUTE ON FUNCTION public.set_tenant_subscription(UUID, TEXT, TEXT, INTEGER)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_subscription(UUID, TEXT, TEXT, INTEGER)
  TO service_role;

COMMIT;
