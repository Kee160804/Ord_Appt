-- Belize Bank subscription payments are not live yet. Earlier development
-- checkouts created paid-looking invoices and active plan periods; normalize
-- them back to the original 14-day trial without deleting the audit records.
BEGIN;

UPDATE public.payment_transactions
SET status = 'FAILED',
    paid_at = NULL,
    metadata = COALESCE(metadata, '{}'::JSONB) || JSONB_BUILD_OBJECT(
      'prelaunch_test', TRUE,
      'prelaunch_note', 'No live bank payment was collected.'
    ),
    updated_at = NOW()
WHERE UPPER(kind) = 'SUBSCRIPTION';

UPDATE public.subscription_invoices
SET status = 'VOID',
    paid_at = NULL,
    updated_at = NOW()
WHERE status <> 'VOID';

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
    updated_at = NOW();

UPDATE public.tenant_seat_entitlements
SET paid_staff_seats = 0,
    updated_at = NOW()
WHERE paid_staff_seats <> 0;

NOTIFY pgrst, 'reload schema';

COMMIT;
