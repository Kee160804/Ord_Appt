-- Keep the standard trial at exactly 14 days and constrain any discretionary
-- super-admin extension to an additional 1 through 14 days.
BEGIN;

UPDATE public.subscription_trial_config
SET trial_days = 14,
    updated_at = NOW()
WHERE singleton = TRUE;

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
  IF v_status = 'trial'
     AND (p_trial_days IS NULL OR p_trial_days < 1 OR p_trial_days > 14) THEN
    RAISE EXCEPTION 'Trial extension must be between 1 and 14 days.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.tenants
  SET plan = v_plan,
      subscription_status = v_status,
      trial_ends_at = CASE
        WHEN v_status = 'trial' THEN
          GREATEST(COALESCE(trial_ends_at, NOW()), NOW())
            + MAKE_INTERVAL(days => p_trial_days)
        ELSE trial_ends_at
      END,
      subscription_base_amount = CASE
        WHEN v_status = 'trial' THEN 0
        ELSE subscription_base_amount
      END,
      subscription_seat_amount = CASE
        WHEN v_status = 'trial' THEN 0
        ELSE subscription_seat_amount
      END,
      subscription_recurring_total = CASE
        WHEN v_status = 'trial' THEN 0
        ELSE subscription_recurring_total
      END,
      current_period_start = CASE
        WHEN v_status = 'trial' THEN NULL
        ELSE current_period_start
      END,
      current_period_end = CASE
        WHEN v_status = 'trial' THEN NULL
        ELSE current_period_end
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

REVOKE ALL ON FUNCTION public.set_tenant_subscription(UUID, TEXT, TEXT, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tenant_subscription(UUID, TEXT, TEXT, INTEGER)
  TO authenticated, service_role;

COMMIT;
