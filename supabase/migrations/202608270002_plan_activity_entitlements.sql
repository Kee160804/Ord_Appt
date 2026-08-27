BEGIN;

-- LocalSpace plan limits are intentionally kept in a small immutable function
-- so public RPCs, owner usage displays, and future payment webhooks share one
-- source of truth. "starter" is the database value for the Beginner plan.
CREATE OR REPLACE FUNCTION public.plan_monthly_activity_limit(p_plan TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE LOWER(COALESCE(p_plan, 'starter'))
    WHEN 'pro' THEN 150
    WHEN 'enterprise' THEN NULL
    ELSE 50
  END;
$$;

REVOKE ALL ON FUNCTION public.plan_monthly_activity_limit(TEXT) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.tenant_monthly_activity_usage(
  p_tenant_id UUID,
  p_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH period AS (
    SELECT
      DATE_TRUNC('month', p_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS starts_at,
      (DATE_TRUNC('month', p_at AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC' AS ends_at
  )
  SELECT
    (SELECT COUNT(*)::INTEGER
     FROM public.orders, period
     WHERE orders.tenant_id = p_tenant_id
       AND orders.created_at >= period.starts_at
       AND orders.created_at < period.ends_at)
    +
    (SELECT COUNT(*)::INTEGER
     FROM public.appointments, period
     WHERE appointments.tenant_id = p_tenant_id
       AND appointments.created_at >= period.starts_at
       AND appointments.created_at < period.ends_at);
$$;

REVOKE ALL ON FUNCTION public.tenant_monthly_activity_usage(UUID, TIMESTAMPTZ) FROM PUBLIC;

CREATE INDEX IF NOT EXISTS orders_tenant_created_at_idx
  ON public.orders (tenant_id, created_at);
CREATE INDEX IF NOT EXISTS appointments_tenant_created_at_idx
  ON public.appointments (tenant_id, created_at);

-- Authenticated tenant members can inspect only their own usage. SUPER_ADMIN
-- and service-role callers retain platform-wide access for support and future
-- subscription automation.
CREATE OR REPLACE FUNCTION public.get_tenant_monthly_usage(p_tenant_id UUID)
RETURNS TABLE (
  plan TEXT,
  activity_count INTEGER,
  activity_limit INTEGER,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  usage_percent NUMERIC,
  is_limit_reached BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_count INTEGER;
  v_limit INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  IF COALESCE(auth.role() = 'service_role', FALSE) = FALSE
     AND public.is_super_admin() = FALSE
     AND NOT EXISTS (
       SELECT 1
       FROM public.tenant_memberships membership
       WHERE membership.tenant_id = p_tenant_id
         AND membership.profile_id = auth.uid()
         AND membership.is_active = TRUE
     )
  THEN
    RAISE EXCEPTION 'You do not have access to this tenant usage.'
      USING ERRCODE = '42501';
  END IF;

  SELECT LOWER(COALESCE(tenant.plan, 'starter'))
  INTO v_plan
  FROM public.tenants tenant
  WHERE tenant.id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found.' USING ERRCODE = 'P0002';
  END IF;

  v_period_start := DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_period_end := (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC';
  v_count := public.tenant_monthly_activity_usage(p_tenant_id, NOW());
  v_limit := public.plan_monthly_activity_limit(v_plan);

  RETURN QUERY SELECT
    v_plan,
    v_count,
    v_limit,
    v_period_start,
    v_period_end,
    CASE
      WHEN v_limit IS NULL OR v_limit = 0 THEN 0::NUMERIC
      ELSE ROUND((v_count::NUMERIC / v_limit::NUMERIC) * 100, 1)
    END,
    v_limit IS NOT NULL AND v_count >= v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_monthly_usage(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_monthly_usage(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tenant_plan_has_feature(
  p_tenant_id UUID,
  p_feature TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE LOWER(COALESCE(p_feature, ''))
    WHEN 'detailed_analytics' THEN
      (LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
       AND COALESCE(tenant.trial_ends_at, tenant.created_at + INTERVAL '14 days') > NOW())
      OR LOWER(COALESCE(tenant.plan, 'starter')) IN ('pro', 'enterprise')
    WHEN 'advanced_catalog' THEN
      (LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
       AND COALESCE(tenant.trial_ends_at, tenant.created_at + INTERVAL '14 days') > NOW())
      OR LOWER(COALESCE(tenant.plan, 'starter')) IN ('pro', 'enterprise')
    WHEN 'booking_deposits' THEN
      (LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
       AND COALESCE(tenant.trial_ends_at, tenant.created_at + INTERVAL '14 days') > NOW())
      OR LOWER(COALESCE(tenant.plan, 'starter')) IN ('pro', 'enterprise')
    WHEN 'storefront_branding' THEN
      (LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
       AND COALESCE(tenant.trial_ends_at, tenant.created_at + INTERVAL '14 days') > NOW())
      OR LOWER(COALESCE(tenant.plan, 'starter')) IN ('pro', 'enterprise')
    ELSE FALSE
  END
  FROM public.tenants tenant
  WHERE tenant.id = p_tenant_id;
$$;

REVOKE ALL ON FUNCTION public.tenant_plan_has_feature(UUID, TEXT) FROM PUBLIC;

-- Protect paid feature fields at the database boundary while allowing existing
-- legacy values to remain untouched. Starter tenants can still edit all basic
-- product/service/business fields because only changes to advanced fields are
-- rejected.
CREATE OR REPLACE FUNCTION public.enforce_advanced_catalog_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_advanced_change BOOLEAN;
BEGIN
  v_tenant_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
  IF COALESCE(auth.role() = 'service_role', FALSE) OR public.is_super_admin() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF public.tenant_plan_has_feature(v_tenant_id, 'advanced_catalog') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'categories' THEN
    RAISE EXCEPTION 'Categories are available on the Pro plan.' USING ERRCODE = '42501';
  END IF;

  v_advanced_change := CASE
    WHEN TG_OP = 'INSERT' THEN
      NEW.category_id IS NOT NULL
      OR NEW.stock IS NOT NULL
      OR COALESCE(NEW.track_inventory, FALSE)
      OR COALESCE(NEW.addons, '[]'::JSONB) <> '[]'::JSONB
    ELSE
      NEW.category_id IS DISTINCT FROM OLD.category_id
      OR (
        NEW.stock IS DISTINCT FROM OLD.stock
        -- Preserve checkout for legacy Starter products that already tracked
        -- inventory before plan enforcement. Checkout may decrement stock, but
        -- owners cannot enable tracking or increase/restock it without Pro.
        AND NOT (
          OLD.stock IS NOT NULL
          AND NEW.stock IS NOT NULL
          AND NEW.stock <= OLD.stock
        )
      )
      OR NEW.track_inventory IS DISTINCT FROM OLD.track_inventory
      OR NEW.addons IS DISTINCT FROM OLD.addons
  END;

  IF v_advanced_change THEN
    RAISE EXCEPTION 'Categories, inventory tracking, and product add-ons are available on the Pro plan.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_advanced_catalog_plan() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_products_plan_features ON public.products;
CREATE TRIGGER trg_products_plan_features
BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.enforce_advanced_catalog_plan();

DROP TRIGGER IF EXISTS trg_categories_plan_features ON public.categories;
CREATE TRIGGER trg_categories_plan_features
BEFORE INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.enforce_advanced_catalog_plan();

CREATE OR REPLACE FUNCTION public.enforce_booking_deposit_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_advanced_change BOOLEAN;
BEGIN
  IF COALESCE(auth.role() = 'service_role', FALSE)
     OR public.is_super_admin()
     OR public.tenant_plan_has_feature(NEW.tenant_id, 'booking_deposits')
  THEN
    RETURN NEW;
  END IF;

  v_advanced_change := CASE
    WHEN TG_OP = 'INSERT' THEN
      COALESCE(NEW.requires_deposit, FALSE)
      OR NEW.deposit_amount IS NOT NULL
      OR NEW.deposit_type IS NOT NULL
    ELSE
      NEW.requires_deposit IS DISTINCT FROM OLD.requires_deposit
      OR NEW.deposit_amount IS DISTINCT FROM OLD.deposit_amount
      OR NEW.deposit_type IS DISTINCT FROM OLD.deposit_type
  END;
  IF v_advanced_change THEN
    RAISE EXCEPTION 'Appointment deposit settings are available on the Pro plan.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_booking_deposit_plan() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_services_plan_features ON public.services;
CREATE TRIGGER trg_services_plan_features
BEFORE INSERT OR UPDATE ON public.services
FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_deposit_plan();

CREATE OR REPLACE FUNCTION public.enforce_storefront_branding_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role() = 'service_role', FALSE)
     OR public.is_super_admin()
     OR public.tenant_plan_has_feature(NEW.id, 'storefront_branding')
  THEN
    RETURN NEW;
  END IF;

  IF NEW.slug IS DISTINCT FROM OLD.slug
     OR NEW.subdomain IS DISTINCT FROM OLD.subdomain
     OR NEW.cover_image IS DISTINCT FROM OLD.cover_image
     OR NEW.primary_color IS DISTINCT FROM OLD.primary_color
     OR NEW.accent_color IS DISTINCT FROM OLD.accent_color
  THEN
    RAISE EXCEPTION 'Storefront URL, cover image, and brand colours are available on the Pro plan.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_storefront_branding_plan() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_tenants_plan_features ON public.tenants;
CREATE TRIGGER trg_tenants_plan_features
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.enforce_storefront_branding_plan();

-- This trigger is the enforcement boundary. It runs inside the same database
-- transaction as public ordering/booking, so a rejected activity cannot create
-- a customer, order, appointment, or inventory change. The advisory lock keeps
-- concurrent requests from exceeding the final available slot.
CREATE OR REPLACE FUNCTION public.enforce_tenant_monthly_activity_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan TEXT;
  v_limit INTEGER;
  v_usage INTEGER;
  v_period_key INTEGER;
  v_period_end TIMESTAMPTZ;
BEGIN
  SELECT LOWER(COALESCE(tenant.plan, 'starter'))
  INTO v_plan
  FROM public.tenants tenant
  WHERE tenant.id = NEW.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant not found.' USING ERRCODE = 'P0002';
  END IF;

  v_limit := public.plan_monthly_activity_limit(v_plan);
  IF v_limit IS NULL THEN
    RETURN NEW;
  END IF;

  v_period_key := TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYYMM')::INTEGER;
  v_period_end := (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC';
  PERFORM PG_ADVISORY_XACT_LOCK(HASHTEXT(NEW.tenant_id::TEXT), v_period_key);

  v_usage := public.tenant_monthly_activity_usage(NEW.tenant_id, NOW());
  IF v_usage >= v_limit THEN
    RAISE EXCEPTION 'The % plan monthly limit of % orders or appointments has been reached. New activity is available on % or after a plan change.',
      INITCAP(v_plan), v_limit, TO_CHAR(v_period_end, 'Mon DD, YYYY')
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_tenant_monthly_activity_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_zz_orders_activity_limit ON public.orders;
CREATE TRIGGER trg_zz_orders_activity_limit
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tenant_monthly_activity_limit();

DROP TRIGGER IF EXISTS trg_zz_appointments_activity_limit ON public.appointments;
CREATE TRIGGER trg_zz_appointments_activity_limit
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tenant_monthly_activity_limit();

NOTIFY pgrst, 'reload schema';

COMMIT;
