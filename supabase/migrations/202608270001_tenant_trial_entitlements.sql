BEGIN;

-- Every new business starts with an exact fourteen-day trial. Existing trial
-- tenants without an end date receive a fresh grace period when this migration
-- is applied so a production deployment cannot lock every legacy tenant out.
ALTER TABLE public.tenants
  ALTER COLUMN plan SET DEFAULT 'starter',
  ALTER COLUMN subscription_status SET DEFAULT 'trial',
  ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '14 days');

UPDATE public.tenants
SET subscription_status = 'trial',
    trial_ends_at = NOW() + INTERVAL '14 days'
WHERE LOWER(COALESCE(subscription_status, 'trial')) = 'trial'
  AND trial_ends_at IS NULL;

CREATE OR REPLACE FUNCTION public.initialize_tenant_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.plan := LOWER(COALESCE(NULLIF(NEW.plan, ''), 'starter'));
  NEW.subscription_status := LOWER(COALESCE(NULLIF(NEW.subscription_status, ''), 'trial'));

  IF NEW.subscription_status = 'trial' AND NEW.trial_ends_at IS NULL THEN
    NEW.trial_ends_at := NOW() + INTERVAL '14 days';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_initialize_tenant_trial ON public.tenants;
CREATE TRIGGER trg_initialize_tenant_trial
BEFORE INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.initialize_tenant_trial();

-- Central entitlement check used by RLS and public order/booking safeguards.
-- SUPER_ADMIN and service-role requests retain platform administration access.
CREATE OR REPLACE FUNCTION public.tenant_subscription_allows_access(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE((SELECT auth.role()) = 'service_role', FALSE)
    OR (SELECT public.is_super_admin())
    OR EXISTS (
      SELECT 1
      FROM public.tenants AS tenant
      WHERE tenant.id = p_tenant_id
        AND tenant.is_active = TRUE
        AND UPPER(tenant.status) = 'ACTIVE'
        AND (
          LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'active'
          OR (
            LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
            AND COALESCE(
              tenant.trial_ends_at,
              tenant.created_at + INTERVAL '14 days'
            ) > NOW()
          )
        )
    );
$$;

REVOKE ALL ON FUNCTION public.tenant_subscription_allows_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_subscription_allows_access(UUID) TO authenticated, service_role;

-- Owners may edit their business record but may never promote their own plan
-- or subscription. Only the service role or a SUPER_ADMIN can do that.
CREATE OR REPLACE FUNCTION public.guard_tenant_subscription_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (
    NEW.plan IS DISTINCT FROM OLD.plan
    OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
    OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at
  )
  AND COALESCE((SELECT auth.role()) = 'service_role', FALSE) = FALSE
  AND (SELECT public.is_super_admin()) = FALSE
  THEN
    RAISE EXCEPTION 'Only a platform administrator can change subscription access.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tenant_subscription_fields ON public.tenants;
CREATE TRIGGER trg_guard_tenant_subscription_fields
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.guard_tenant_subscription_fields();

-- Secured administration hook for a SUPER_ADMIN or a future payment webhook.
CREATE OR REPLACE FUNCTION public.set_tenant_subscription(
  p_tenant_id UUID,
  p_plan TEXT,
  p_subscription_status TEXT,
  p_trial_days INTEGER DEFAULT NULL
)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant public.tenants;
  v_plan TEXT := LOWER(COALESCE(p_plan, ''));
  v_status TEXT := LOWER(COALESCE(p_subscription_status, ''));
BEGIN
  IF COALESCE(auth.role() = 'service_role', FALSE) = FALSE
     AND public.is_super_admin() = FALSE THEN
    RAISE EXCEPTION 'Only a platform administrator can update subscriptions.'
      USING ERRCODE = '42501';
  END IF;

  IF v_plan NOT IN ('starter', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'Choose a valid subscription plan.' USING ERRCODE = '22023';
  END IF;
  IF v_status NOT IN ('trial', 'active', 'cancelled', 'past_due') THEN
    RAISE EXCEPTION 'Choose a valid subscription status.' USING ERRCODE = '22023';
  END IF;
  IF v_status = 'trial' AND COALESCE(p_trial_days, 14) < 1 THEN
    RAISE EXCEPTION 'Trial days must be at least one.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.tenants
  SET plan = v_plan,
      subscription_status = v_status,
      trial_ends_at = CASE
        WHEN v_status = 'trial'
          THEN NOW() + MAKE_INTERVAL(days => COALESCE(p_trial_days, 14))
        ELSE trial_ends_at
      END,
      updated_at = NOW()
  WHERE id = p_tenant_id
  RETURNING * INTO v_tenant;

  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant not found.' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_tenant;
END;
$$;

REVOKE ALL ON FUNCTION public.set_tenant_subscription(UUID, TEXT, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_subscription(UUID, TEXT, TEXT, INTEGER) TO authenticated, service_role;

-- Restrictive policies are combined with the existing membership policies,
-- so authenticated tenant users need both membership and a valid entitlement.
DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'business_settings',
    'business_modules',
    'business_hours',
    'categories',
    'products',
    'services',
    'staff',
    'staff_services',
    'customers',
    'orders',
    'order_items',
    'appointments',
    'appointment_services',
    'appointment_email_deliveries',
    'business_reviews'
  ]
  LOOP
    IF TO_REGCLASS(FORMAT('public.%I', v_table)) IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = v_table
           AND column_name = 'tenant_id'
       )
    THEN
      EXECUTE FORMAT('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS tenant_subscription_access_required ON public.%I',
        v_table
      );
      EXECUTE FORMAT(
        'CREATE POLICY tenant_subscription_access_required
         ON public.%I AS RESTRICTIVE
         FOR ALL TO authenticated
         USING (public.tenant_subscription_allows_access(tenant_id))
         WITH CHECK (public.tenant_subscription_allows_access(tenant_id))',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

-- Public storefront RPCs run as security definers. These triggers ensure an
-- expired storefront cannot accept new orders or appointments even when the
-- caller is anonymous.
CREATE OR REPLACE FUNCTION public.enforce_tenant_subscription_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.tenant_subscription_allows_access(NEW.tenant_id) THEN
    RAISE EXCEPTION 'This business subscription is inactive. New orders and appointments are paused.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_require_subscription ON public.orders;
CREATE TRIGGER trg_orders_require_subscription
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tenant_subscription_write();

DROP TRIGGER IF EXISTS trg_appointments_require_subscription ON public.appointments;
CREATE TRIGGER trg_appointments_require_subscription
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tenant_subscription_write();

NOTIFY pgrst, 'reload schema';

COMMIT;
