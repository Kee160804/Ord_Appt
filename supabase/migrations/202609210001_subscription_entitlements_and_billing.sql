BEGIN;

-- Canonical database-side plan catalog. Application code mirrors this catalog
-- in app/lib/plan-catalog.mjs and contract tests prevent the two boundaries
-- from drifting. All authoritative database calculations read this table.
CREATE TABLE IF NOT EXISTS public.subscription_plan_catalog (
  id TEXT PRIMARY KEY CHECK (id IN ('starter', 'pro', 'enterprise')),
  public_name TEXT NOT NULL,
  monthly_price NUMERIC(12,2) NOT NULL CHECK (monthly_price >= 0),
  monthly_activity_limit INTEGER CHECK (monthly_activity_limit IS NULL OR monthly_activity_limit > 0),
  included_staff_seats INTEGER NOT NULL CHECK (included_staff_seats >= 0),
  max_staff_seats INTEGER NOT NULL CHECK (max_staff_seats >= included_staff_seats),
  additional_staff_seat_price NUMERIC(12,2) NOT NULL CHECK (additional_staff_seat_price >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_plan_catalog (
  id, public_name, monthly_price, monthly_activity_limit,
  included_staff_seats, max_staff_seats, additional_staff_seat_price
) VALUES
  ('starter', 'Beginner', 9, 50, 0, 0, 2),
  ('pro', 'Pro', 12, 150, 1, 4, 2),
  ('enterprise', 'Enterprise', 15, NULL, 2, 9, 2)
ON CONFLICT (id) DO UPDATE SET
  public_name = EXCLUDED.public_name,
  monthly_price = EXCLUDED.monthly_price,
  monthly_activity_limit = EXCLUDED.monthly_activity_limit,
  included_staff_seats = EXCLUDED.included_staff_seats,
  max_staff_seats = EXCLUDED.max_staff_seats,
  additional_staff_seat_price = EXCLUDED.additional_staff_seat_price,
  updated_at = NOW();

REVOKE ALL ON public.subscription_plan_catalog FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_plan_catalog
  FROM authenticated;
GRANT SELECT ON public.subscription_plan_catalog TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.subscription_trial_config (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  trial_days INTEGER NOT NULL CHECK (trial_days > 0),
  monthly_activity_limit INTEGER NOT NULL CHECK (monthly_activity_limit > 0),
  included_staff_seats INTEGER NOT NULL CHECK (included_staff_seats >= 0),
  max_staff_seats INTEGER NOT NULL CHECK (max_staff_seats >= included_staff_seats),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.subscription_trial_config (
  singleton, trial_days, monthly_activity_limit,
  included_staff_seats, max_staff_seats
) VALUES (TRUE, 14, 150, 1, 1)
ON CONFLICT (singleton) DO UPDATE SET
  trial_days = EXCLUDED.trial_days,
  monthly_activity_limit = EXCLUDED.monthly_activity_limit,
  included_staff_seats = EXCLUDED.included_staff_seats,
  max_staff_seats = EXCLUDED.max_staff_seats,
  updated_at = NOW();

REVOKE ALL ON public.subscription_trial_config FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscription_trial_config
  FROM authenticated;
GRANT SELECT ON public.subscription_trial_config TO authenticated, service_role;

-- Some existing deployments predate the provider-neutral payment migration.
-- Create the two subscription ledger tables here as well so this forward-only
-- lifecycle migration can be applied safely without assuming they exist.
CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BZD',
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'OPEN', 'PAID', 'VOID')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  line_items JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS subscription_invoices_tenant_created_idx
  ON public.subscription_invoices (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.subscription_invoices(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'MOCK',
  provider_reference TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ORDER', 'APPOINTMENT', 'SUBSCRIPTION')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BZD',
  status TEXT NOT NULL CHECK (
    status IN ('PENDING', 'SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED')
  ),
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((order_id IS NOT NULL)::INTEGER + (appointment_id IS NOT NULL)::INTEGER <= 1),
  CHECK (refunded_amount <= amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_reference_idx
  ON public.payment_transactions (provider, provider_reference);
CREATE INDEX IF NOT EXISTS payment_transactions_tenant_created_idx
  ON public.payment_transactions (tenant_id, created_at DESC);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_transactions'
      AND policyname = 'payment_transactions_tenant_select'
  ) THEN
    CREATE POLICY payment_transactions_tenant_select
      ON public.payment_transactions FOR SELECT TO authenticated
      USING (public.user_has_tenant_access(tenant_id) OR public.is_super_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'subscription_invoices'
      AND policyname = 'subscription_invoices_tenant_select'
  ) THEN
    CREATE POLICY subscription_invoices_tenant_select
      ON public.subscription_invoices FOR SELECT TO authenticated
      USING (public.user_has_tenant_access(tenant_id) OR public.is_super_admin());
  END IF;
END;
$$;

GRANT SELECT ON public.payment_transactions, public.subscription_invoices
  TO authenticated;
GRANT ALL ON public.payment_transactions, public.subscription_invoices
  TO service_role;
REVOKE INSERT, UPDATE, DELETE ON
  public.payment_transactions, public.subscription_invoices
  FROM authenticated, anon;

-- Keep this forward-only migration safe for deployments that have not yet
-- applied the storefront cover-framing migration. The application writes all
-- three fields whenever storefront settings are saved.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS cover_image_position_x SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_image_position_y SMALLINT NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cover_image_zoom SMALLINT NOT NULL DEFAULT 100;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_cover_image_position_x_check,
  DROP CONSTRAINT IF EXISTS tenants_cover_image_position_y_check,
  DROP CONSTRAINT IF EXISTS tenants_cover_image_zoom_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_cover_image_position_x_check
    CHECK (cover_image_position_x BETWEEN 0 AND 100),
  ADD CONSTRAINT tenants_cover_image_position_y_check
    CHECK (cover_image_position_y BETWEEN 0 AND 100),
  ADD CONSTRAINT tenants_cover_image_zoom_check
    CHECK (cover_image_zoom BETWEEN 100 AND 200);

-- Provider-neutral monthly lifecycle fields. Provider identifiers remain null
-- for development mock payments and until a real adapter supplies them.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provider_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_base_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_seat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_recurring_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_paid_staff_seats INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subscription_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_subscription_amounts_check,
  DROP CONSTRAINT IF EXISTS tenants_subscription_paid_staff_seats_check,
  DROP CONSTRAINT IF EXISTS tenants_subscription_period_check;
ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_subscription_amounts_check CHECK (
    subscription_base_amount >= 0
    AND subscription_seat_amount >= 0
    AND subscription_recurring_total = subscription_base_amount + subscription_seat_amount
  ),
  ADD CONSTRAINT tenants_subscription_paid_staff_seats_check
    CHECK (subscription_paid_staff_seats BETWEEN 0 AND 7),
  ADD CONSTRAINT tenants_subscription_period_check
    CHECK (current_period_end IS NULL OR current_period_start IS NULL OR current_period_end > current_period_start);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_provider_subscription_id_idx
  ON public.tenants (provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- Retire the legacy direct mock activation RPC. Development checkout now goes
-- through the provider abstraction and the same server-validated completion
-- function a verified production webhook will use.
DO $$
BEGIN
  IF TO_REGPROCEDURE('public.complete_mock_subscription_checkout(uuid,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.complete_mock_subscription_checkout(UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END;
$$;

-- Preserve legitimate current paid periods from the invoice ledger. An old
-- `active` flag without a current paid invoice is deliberately not backfilled
-- into permanent access.
INSERT INTO public.tenant_seat_entitlements (tenant_id)
SELECT tenant.id
FROM public.tenants tenant
ON CONFLICT (tenant_id) DO NOTHING;

WITH latest_paid_invoice AS (
  SELECT DISTINCT ON (invoice.tenant_id)
    invoice.tenant_id,
    invoice.period_start,
    invoice.period_end
  FROM public.subscription_invoices invoice
  WHERE invoice.status = 'PAID'
  ORDER BY invoice.tenant_id, invoice.period_end DESC, invoice.created_at DESC
)
UPDATE public.tenants tenant
SET current_period_start = COALESCE(tenant.current_period_start, invoice.period_start),
    current_period_end = COALESCE(tenant.current_period_end, invoice.period_end)
FROM latest_paid_invoice invoice
WHERE invoice.tenant_id = tenant.id;

UPDATE public.tenants tenant
SET subscription_base_amount = catalog.monthly_price,
    subscription_paid_staff_seats = LEAST(
      catalog.max_staff_seats - catalog.included_staff_seats,
      COALESCE(entitlement.paid_staff_seats, 0)
    ),
    subscription_seat_amount = LEAST(
      catalog.max_staff_seats - catalog.included_staff_seats,
      COALESCE(entitlement.paid_staff_seats, 0)
    ) * catalog.additional_staff_seat_price,
    subscription_recurring_total = catalog.monthly_price + (
      LEAST(
        catalog.max_staff_seats - catalog.included_staff_seats,
        COALESCE(entitlement.paid_staff_seats, 0)
      ) * catalog.additional_staff_seat_price
    ),
    subscription_updated_at = NOW()
FROM public.subscription_plan_catalog catalog,
     public.tenant_seat_entitlements entitlement
WHERE entitlement.tenant_id = tenant.id
  AND catalog.id = CASE LOWER(COALESCE(tenant.plan, 'starter'))
  WHEN 'pro' THEN 'pro'
  WHEN 'enterprise' THEN 'enterprise'
  ELSE 'starter'
END;

UPDATE public.tenants
SET subscription_status = 'expired',
    subscription_updated_at = NOW()
WHERE LOWER(COALESCE(subscription_status, 'trial')) = 'active'
  AND (current_period_end IS NULL OR current_period_end <= NOW());

CREATE OR REPLACE FUNCTION public.plan_monthly_activity_limit(p_plan TEXT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT catalog.monthly_activity_limit
  FROM public.subscription_plan_catalog catalog
  WHERE catalog.id = CASE LOWER(COALESCE(p_plan, 'starter'))
    WHEN 'pro' THEN 'pro'
    WHEN 'enterprise' THEN 'enterprise'
    ELSE 'starter'
  END;
$$;

CREATE OR REPLACE FUNCTION public.team_plan_included_staff(p_plan TEXT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT catalog.included_staff_seats
  FROM public.subscription_plan_catalog catalog
  WHERE catalog.id = CASE LOWER(COALESCE(p_plan, 'starter'))
    WHEN 'pro' THEN 'pro'
    WHEN 'enterprise' THEN 'enterprise'
    ELSE 'starter'
  END;
$$;

CREATE OR REPLACE FUNCTION public.team_plan_max_staff(p_plan TEXT)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT catalog.max_staff_seats
  FROM public.subscription_plan_catalog catalog
  WHERE catalog.id = CASE LOWER(COALESCE(p_plan, 'starter'))
    WHEN 'pro' THEN 'pro'
    WHEN 'enterprise' THEN 'enterprise'
    ELSE 'starter'
  END;
$$;

-- One authoritative entitlement snapshot for access, features, quotas and team
-- capacity. A paid subscription is valid only while its period is current.
CREATE OR REPLACE FUNCTION public.tenant_effective_entitlements(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT JSONB_BUILD_OBJECT(
    'tenantId', tenant.id,
    'plan', catalog.id,
    'subscriptionStatus', LOWER(COALESCE(tenant.subscription_status, 'trial')),
    'isTrial', state.is_live_trial,
    'hasAccess', state.is_live_trial OR state.has_paid_access,
    'trialEndsAt', tenant.trial_ends_at,
    'currentPeriodStart', tenant.current_period_start,
    'currentPeriodEnd', tenant.current_period_end,
    'cancelAtPeriodEnd', tenant.cancel_at_period_end,
    'activityLimit', CASE
      WHEN state.is_live_trial THEN trial.monthly_activity_limit
      ELSE catalog.monthly_activity_limit
    END,
    'includedStaffSeats', CASE
      WHEN state.is_live_trial THEN trial.included_staff_seats
      ELSE catalog.included_staff_seats
    END,
    'maxStaffSeats', CASE
      WHEN state.is_live_trial THEN trial.max_staff_seats
      ELSE catalog.max_staff_seats
    END,
    'additionalStaffSeatPrice', catalog.additional_staff_seat_price,
    'paidStaffSeats', CASE
      WHEN state.is_live_trial THEN 0
      ELSE tenant.subscription_paid_staff_seats
    END,
    'baseAmount', tenant.subscription_base_amount,
    'seatAmount', tenant.subscription_seat_amount,
    'recurringTotal', tenant.subscription_recurring_total
  )
  FROM public.tenants tenant
  JOIN public.subscription_plan_catalog catalog
    ON catalog.id = CASE LOWER(COALESCE(tenant.plan, 'starter'))
      WHEN 'pro' THEN 'pro'
      WHEN 'enterprise' THEN 'enterprise'
      ELSE 'starter'
    END
  CROSS JOIN public.subscription_trial_config trial
  CROSS JOIN LATERAL (
    SELECT
      LOWER(COALESCE(tenant.subscription_status, 'trial')) IN ('trial', 'trialing')
        AND COALESCE(
          tenant.trial_ends_at,
          tenant.created_at + MAKE_INTERVAL(days => trial.trial_days)
        ) > NOW() AS is_live_trial,
      LOWER(COALESCE(tenant.subscription_status, '')) IN ('active', 'cancelled', 'canceled')
        AND tenant.current_period_end IS NOT NULL
        AND tenant.current_period_end > NOW() AS has_paid_access
  ) state
  WHERE tenant.id = p_tenant_id;
$$;

REVOKE ALL ON FUNCTION public.tenant_effective_entitlements(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_effective_entitlements(UUID)
  TO authenticated, service_role;

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
    OR COALESCE(
      (public.tenant_effective_entitlements(p_tenant_id)->>'hasAccess')::BOOLEAN,
      FALSE
    );
$$;

REVOKE ALL ON FUNCTION public.tenant_subscription_allows_access(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_subscription_allows_access(UUID)
  TO authenticated, service_role;

-- Growth-tool RLS and RPCs historically used a separate helper. Keep the
-- public contract while routing it through the same period-aware entitlement
-- decision so an old `active` flag can never grant indefinite access.
CREATE OR REPLACE FUNCTION public.growth_tools_subscription_allows_access(
  p_tenant_id UUID
)
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
      FROM public.tenants tenant
      WHERE tenant.id = p_tenant_id
        AND tenant.is_active = TRUE
        AND UPPER(COALESCE(tenant.status, 'ACTIVE')) = 'ACTIVE'
        AND COALESCE(
          (public.tenant_effective_entitlements(p_tenant_id)->>'hasAccess')::BOOLEAN,
          FALSE
        )
    );
$$;

REVOKE ALL ON FUNCTION public.growth_tools_subscription_allows_access(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.growth_tools_subscription_allows_access(UUID)
  TO authenticated, service_role;

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
  WITH entitlement AS (
    SELECT public.tenant_effective_entitlements(p_tenant_id) AS value
  )
  SELECT COALESCE(
    (value->>'hasAccess')::BOOLEAN
    AND CASE LOWER(COALESCE(p_feature, ''))
      WHEN 'detailed_analytics' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'advanced_catalog' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'product_variants' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'booking_deposits' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'storefront_branding' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'storefront_contact_form' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      WHEN 'team_management' THEN
        (value->>'isTrial')::BOOLEAN OR value->>'plan' IN ('pro', 'enterprise')
      ELSE FALSE
    END,
    FALSE
  )
  FROM entitlement;
$$;

REVOKE ALL ON FUNCTION public.tenant_plan_has_feature(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_plan_has_feature(UUID, TEXT)
  TO authenticated, service_role;

-- Contact submission is executed only by the protected server route. Reuse
-- the canonical feature decision so `trialing`, trial expiry and paid period
-- expiry behave exactly like the rest of the application.
CREATE OR REPLACE FUNCTION public.submit_storefront_contact_message(
  p_tenant_id UUID,
  p_sender_name TEXT,
  p_sender_email TEXT,
  p_subject TEXT,
  p_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
  v_message_id UUID;
  v_name TEXT := BTRIM(COALESCE(p_sender_name, ''));
  v_email TEXT := LOWER(BTRIM(COALESCE(p_sender_email, '')));
  v_subject TEXT := BTRIM(COALESCE(p_subject, ''));
  v_body TEXT := BTRIM(COALESCE(p_message, ''));
BEGIN
  IF LENGTH(v_name) < 2 OR LENGTH(v_name) > 120 THEN
    RAISE EXCEPTION 'Enter a valid name.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(v_email) > 254 OR v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE = '22023';
  END IF;
  IF LENGTH(v_subject) > 160 OR LENGTH(v_body) < 2 OR LENGTH(v_body) > 5000 THEN
    RAISE EXCEPTION 'Enter a message between 2 and 5000 characters.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants tenant
  WHERE tenant.id = p_tenant_id
    AND tenant.is_active = TRUE
    AND UPPER(tenant.status) = 'ACTIVE'
    AND NULLIF(BTRIM(tenant.email), '') IS NOT NULL
    AND public.tenant_plan_has_feature(tenant.id, 'storefront_contact_form');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This business is not accepting storefront messages.' USING ERRCODE = 'P0001';
  END IF;

  IF (SELECT COUNT(*) FROM public.storefront_contact_messages contact
      WHERE contact.tenant_id = p_tenant_id
        AND contact.sender_email = v_email
        AND contact.created_at > NOW() - INTERVAL '15 minutes') >= 5 THEN
    RAISE EXCEPTION 'Too many messages were submitted. Please try again later.' USING ERRCODE = 'P0001';
  END IF;

  IF v_subject = '' THEN v_subject := 'Storefront message from ' || v_name; END IF;
  INSERT INTO public.storefront_contact_messages
    (tenant_id, sender_name, sender_email, subject, message)
  VALUES (p_tenant_id, v_name, v_email, v_subject, v_body)
  RETURNING id INTO v_message_id;

  BEGIN
    INSERT INTO public.transactional_email_deliveries (
      tenant_id, event_type, source_table, source_id, recipient_email,
      recipient_name, subject, payload, idempotency_key
    ) VALUES (
      p_tenant_id, 'CONTACT_FORM_MESSAGE', 'storefront_contact_messages', v_message_id,
      LOWER(v_tenant.email), v_tenant.business_name, v_subject,
      JSONB_BUILD_OBJECT('business_name', v_tenant.business_name, 'sender_email', v_email,
        'message_subject', v_subject, 'message', v_body),
      'contact/' || v_message_id::TEXT
    );
    INSERT INTO public.business_notifications
      (tenant_id, type, title, message, source_table, source_id, event_key, href)
    VALUES (p_tenant_id, 'SYSTEM', 'New storefront message',
      v_name || ' sent a contact message.', 'storefront_contact_messages',
      v_message_id, 'CONTACT_MESSAGE', '/dashboard/customers')
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Contact message % saved but notification enqueue failed: %', v_message_id, SQLERRM;
  END;
  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_storefront_contact_message(
  UUID, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_storefront_contact_message(
  UUID, TEXT, TEXT, TEXT, TEXT
) TO service_role;

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
  v_entitlement JSONB;
  v_plan TEXT;
  v_count INTEGER;
  v_limit INTEGER;
  v_period_start TIMESTAMPTZ;
  v_period_end TIMESTAMPTZ;
BEGIN
  IF COALESCE(auth.role() = 'service_role', FALSE) = FALSE
     AND public.is_super_admin() = FALSE
     AND NOT EXISTS (
       SELECT 1 FROM public.tenant_memberships membership
       WHERE membership.tenant_id = p_tenant_id
         AND membership.profile_id = auth.uid()
         AND membership.is_active = TRUE
     )
  THEN
    RAISE EXCEPTION 'You do not have access to this tenant usage.'
      USING ERRCODE = '42501';
  END IF;

  v_entitlement := public.tenant_effective_entitlements(p_tenant_id);
  IF v_entitlement IS NULL THEN
    RAISE EXCEPTION 'Tenant not found.' USING ERRCODE = 'P0002';
  END IF;
  v_plan := v_entitlement->>'plan';
  v_limit := NULLIF(v_entitlement->>'activityLimit', '')::INTEGER;
  v_count := public.tenant_monthly_activity_usage(p_tenant_id, NOW());
  v_period_start := DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_period_end := (DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC') + INTERVAL '1 month') AT TIME ZONE 'UTC';

  RETURN QUERY SELECT
    v_plan,
    v_count,
    v_limit,
    v_period_start,
    v_period_end,
    CASE WHEN v_limit IS NULL OR v_limit = 0 THEN 0::NUMERIC
      ELSE ROUND((v_count::NUMERIC / v_limit::NUMERIC) * 100, 1) END,
    v_limit IS NOT NULL AND v_count >= v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_tenant_monthly_activity_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_entitlement JSONB;
  v_plan TEXT;
  v_limit INTEGER;
  v_usage INTEGER;
  v_period_key INTEGER;
  v_period_end TIMESTAMPTZ;
BEGIN
  v_entitlement := public.tenant_effective_entitlements(NEW.tenant_id);
  IF v_entitlement IS NULL OR COALESCE((v_entitlement->>'hasAccess')::BOOLEAN, FALSE) = FALSE THEN
    RAISE EXCEPTION 'This business does not have an active trial or paid subscription.'
      USING ERRCODE = '42501';
  END IF;
  v_plan := v_entitlement->>'plan';
  v_limit := NULLIF(v_entitlement->>'activityLimit', '')::INTEGER;
  IF v_limit IS NULL THEN RETURN NEW; END IF;

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

-- Trial-aware staff capacity. Trial staff are included and never billed.
CREATE OR REPLACE FUNCTION public.tenant_authorized_staff_capacity(p_tenant_id UUID)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH entitlement AS (
    SELECT public.tenant_effective_entitlements(p_tenant_id) AS value
  )
  SELECT CASE
    WHEN COALESCE((value->>'hasAccess')::BOOLEAN, FALSE) = FALSE THEN 0
    WHEN (value->>'isTrial')::BOOLEAN THEN (value->>'maxStaffSeats')::INTEGER
    ELSE LEAST(
      (value->>'maxStaffSeats')::INTEGER,
      (value->>'includedStaffSeats')::INTEGER + (value->>'paidStaffSeats')::INTEGER
    )
  END
  FROM entitlement;
$$;

-- Keep the mature roles/members/invitations aggregation and overlay the new
-- authoritative capacity values without copying that large implementation.
DO $$
BEGIN
  IF TO_REGPROCEDURE('public.get_tenant_team_summary_legacy(uuid)') IS NULL THEN
    ALTER FUNCTION public.get_tenant_team_summary(UUID)
      RENAME TO get_tenant_team_summary_legacy;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_team_summary(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_base JSONB;
  v_entitlement JSONB;
  v_paid INTEGER;
  v_authorized INTEGER;
BEGIN
  v_base := public.get_tenant_team_summary_legacy(p_tenant_id);
  v_entitlement := public.tenant_effective_entitlements(p_tenant_id);
  IF v_entitlement IS NULL THEN
    RAISE EXCEPTION 'Business not found.' USING ERRCODE = 'P0002';
  END IF;
  v_paid := CASE WHEN (v_entitlement->>'isTrial')::BOOLEAN
    THEN 0 ELSE (v_entitlement->>'paidStaffSeats')::INTEGER END;
  v_authorized := COALESCE(public.tenant_authorized_staff_capacity(p_tenant_id), 0);
  RETURN v_base || JSONB_BUILD_OBJECT(
    'includedStaff', (v_entitlement->>'includedStaffSeats')::INTEGER,
    'maxStaff', (v_entitlement->>'maxStaffSeats')::INTEGER,
    'paidStaffSeats', v_paid,
    'authorizedStaff', v_authorized,
    'additionalSeatPrice', (v_entitlement->>'additionalStaffSeatPrice')::NUMERIC,
    'monthlySeatCharge', CASE WHEN (v_entitlement->>'isTrial')::BOOLEAN
      THEN 0 ELSE (v_entitlement->>'seatAmount')::NUMERIC END,
    'isTrial', (v_entitlement->>'isTrial')::BOOLEAN
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_team_summary(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_team_summary(UUID) TO authenticated;

-- Protect retail variants even when a tenant member writes directly through
-- Supabase instead of using the React controls.
CREATE OR REPLACE FUNCTION public.enforce_product_variant_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product_id UUID := CASE WHEN TG_OP = 'DELETE' THEN OLD.product_id ELSE NEW.product_id END;
  v_tenant_id UUID;
BEGIN
  SELECT product.tenant_id INTO v_tenant_id
  FROM public.products product
  WHERE product.id = v_product_id;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'The parent product could not be found.' USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(auth.role() = 'service_role', FALSE)
     OR public.is_super_admin()
     OR public.tenant_plan_has_feature(v_tenant_id, 'product_variants')
  THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Product variants are available on the Pro plan.'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS trg_product_variants_plan_features ON public.product_variants;
CREATE TRIGGER trg_product_variants_plan_features
BEFORE INSERT OR UPDATE OR DELETE ON public.product_variants
FOR EACH ROW EXECUTE FUNCTION public.enforce_product_variant_plan();

-- Replace the existing branding trigger function so every premium framing and
-- identity field is protected at the same database boundary.
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
     OR NEW.cover_image_position_x IS DISTINCT FROM OLD.cover_image_position_x
     OR NEW.cover_image_position_y IS DISTINCT FROM OLD.cover_image_position_y
     OR NEW.cover_image_zoom IS DISTINCT FROM OLD.cover_image_zoom
     OR NEW.primary_color IS DISTINCT FROM OLD.primary_color
     OR NEW.accent_color IS DISTINCT FROM OLD.accent_color
     OR NEW.social_links IS DISTINCT FROM OLD.social_links
     OR NEW.custom_domain IS DISTINCT FROM OLD.custom_domain
  THEN
    RAISE EXCEPTION 'Storefront identity, cover framing, custom domain, and brand colours are available on the Pro plan.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Server-only, idempotent subscription completion. Expected amounts are
-- checked against the catalog to prevent a compromised browser from choosing
-- its own prices. A real provider adapter can call the same function after a
-- verified webhook; development mock checkout calls it synchronously.
CREATE OR REPLACE FUNCTION public.complete_subscription_checkout_v2(
  p_tenant_id UUID,
  p_plan TEXT,
  p_paid_staff_seats INTEGER,
  p_expected_base_amount NUMERIC,
  p_expected_seat_amount NUMERIC,
  p_expected_total NUMERIC,
  p_provider TEXT,
  p_provider_reference TEXT,
  p_provider_customer_id TEXT,
  p_provider_subscription_id TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_catalog public.subscription_plan_catalog%ROWTYPE;
  v_max_paid INTEGER;
  v_active_staff INTEGER;
  v_seat_amount NUMERIC(12,2);
  v_total NUMERIC(12,2);
  v_period_start TIMESTAMPTZ := NOW();
  v_period_end TIMESTAMPTZ := NOW() + INTERVAL '1 month';
  v_invoice UUID;
  v_invoice_number TEXT;
  v_existing RECORD;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  p_plan := LOWER(COALESCE(p_plan, ''));
  SELECT * INTO v_catalog
  FROM public.subscription_plan_catalog catalog WHERE catalog.id = p_plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Choose a valid plan.' USING ERRCODE = '22023'; END IF;
  IF p_paid_staff_seats IS NULL OR p_paid_staff_seats < 0 THEN
    RAISE EXCEPTION 'Paid staff seats must be a non-negative whole number.' USING ERRCODE = '22023';
  END IF;
  v_max_paid := v_catalog.max_staff_seats - v_catalog.included_staff_seats;
  IF p_paid_staff_seats > v_max_paid THEN
    RAISE EXCEPTION 'Paid staff seats exceed this plan allowance.' USING ERRCODE = '22023';
  END IF;
  v_seat_amount := p_paid_staff_seats * v_catalog.additional_staff_seat_price;
  v_total := v_catalog.monthly_price + v_seat_amount;
  IF p_expected_base_amount IS DISTINCT FROM v_catalog.monthly_price
     OR p_expected_seat_amount IS DISTINCT FROM v_seat_amount
     OR p_expected_total IS DISTINCT FROM v_total
  THEN
    RAISE EXCEPTION 'Subscription pricing changed. Refresh and try again.' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(COALESCE(p_idempotency_key, '')), '') IS NULL
     OR NULLIF(BTRIM(COALESCE(p_provider_reference, '')), '') IS NULL
  THEN
    RAISE EXCEPTION 'Provider reference and idempotency key are required.' USING ERRCODE = '22023';
  END IF;

  -- Serialize retries for the same provider request so concurrent webhooks or
  -- HTTP retries return the original result instead of racing the unique key.
  PERFORM PG_ADVISORY_XACT_LOCK(HASHTEXT(p_idempotency_key));

  SELECT payment.id, payment.invoice_id, payment.tenant_id,
         payment.metadata
  INTO v_existing
  FROM public.payment_transactions payment
  WHERE payment.idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_existing.tenant_id IS DISTINCT FROM p_tenant_id
       OR v_existing.metadata->>'plan' IS DISTINCT FROM p_plan
       OR COALESCE((v_existing.metadata->>'paidStaffSeats')::INTEGER, -1)
            IS DISTINCT FROM p_paid_staff_seats
       OR COALESCE((v_existing.metadata->>'recurringTotal')::NUMERIC, -1)
            IS DISTINCT FROM v_total
    THEN
      RAISE EXCEPTION 'This checkout request ID was already used for different subscription details.'
        USING ERRCODE = '22023';
    END IF;
    RETURN JSONB_BUILD_OBJECT(
      'idempotent', TRUE,
      'invoiceId', v_existing.invoice_id,
      'plan', p_plan,
      'baseAmount', v_catalog.monthly_price,
      'seatAmount', v_seat_amount,
      'recurringTotal', v_total,
      'paidStaffSeats', p_paid_staff_seats,
      'currency', 'BZD',
      'status', 'active'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants tenant WHERE tenant.id = p_tenant_id) THEN
    RAISE EXCEPTION 'Business not found.' USING ERRCODE = 'P0002';
  END IF;
  SELECT COUNT(*)::INTEGER INTO v_active_staff
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER';
  IF v_active_staff > v_catalog.included_staff_seats + p_paid_staff_seats THEN
    RAISE EXCEPTION 'Remove active staff or purchase enough seats before changing this subscription.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tenant_seat_entitlements (tenant_id, paid_staff_seats, updated_at)
  VALUES (p_tenant_id, p_paid_staff_seats, NOW())
  ON CONFLICT (tenant_id) DO UPDATE SET
    paid_staff_seats = EXCLUDED.paid_staff_seats,
    updated_at = NOW();

  v_invoice_number := 'YB-' || TO_CHAR(v_period_start, 'YYYYMM') || '-'
    || UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT, '-', ''), 10));
  INSERT INTO public.subscription_invoices (
    tenant_id, invoice_number, plan, amount, status,
    period_start, period_end, due_at, paid_at, line_items
  ) VALUES (
    p_tenant_id, v_invoice_number, p_plan, v_total, 'PAID',
    v_period_start, v_period_end, v_period_start, v_period_start,
    JSONB_BUILD_ARRAY(
      JSONB_BUILD_OBJECT(
        'kind', 'BASE_PLAN', 'description', v_catalog.public_name || ' monthly subscription',
        'quantity', 1, 'unitAmount', v_catalog.monthly_price,
        'amount', v_catalog.monthly_price
      ),
      JSONB_BUILD_OBJECT(
        'kind', 'STAFF_SEATS', 'description', 'Additional staff seats',
        'quantity', p_paid_staff_seats,
        'unitAmount', v_catalog.additional_staff_seat_price,
        'amount', v_seat_amount
      )
    )
  ) RETURNING id INTO v_invoice;

  INSERT INTO public.payment_transactions (
    tenant_id, invoice_id, provider, provider_reference, kind, amount,
    status, idempotency_key, paid_at, metadata
  ) VALUES (
    p_tenant_id, v_invoice, UPPER(p_provider), p_provider_reference,
    'SUBSCRIPTION', v_total, 'SUCCEEDED', p_idempotency_key, v_period_start,
    JSONB_BUILD_OBJECT(
      'plan', p_plan, 'paidStaffSeats', p_paid_staff_seats,
      'baseAmount', v_catalog.monthly_price, 'seatAmount', v_seat_amount,
      'recurringTotal', v_total
    )
  );

  UPDATE public.tenants SET
    plan = p_plan,
    subscription_status = 'active',
    current_period_start = v_period_start,
    current_period_end = v_period_end,
    cancel_at_period_end = FALSE,
    canceled_at = NULL,
    provider_customer_id = NULLIF(BTRIM(COALESCE(p_provider_customer_id, '')), ''),
    provider_subscription_id = NULLIF(BTRIM(COALESCE(p_provider_subscription_id, '')), ''),
    subscription_base_amount = v_catalog.monthly_price,
    subscription_seat_amount = v_seat_amount,
    subscription_recurring_total = v_total,
    subscription_paid_staff_seats = p_paid_staff_seats,
    subscription_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_tenant_id;

  UPDATE public.tenant_seat_change_requests
  SET status = 'APPROVED', reviewed_at = NOW(),
      review_note = CONCAT_WS(' ', NULLIF(BTRIM(review_note), ''), 'Completed through subscription checkout.')
  WHERE tenant_id = p_tenant_id AND status = 'PENDING';

  RETURN JSONB_BUILD_OBJECT(
    'idempotent', FALSE,
    'invoiceId', v_invoice,
    'invoiceNumber', v_invoice_number,
    'plan', p_plan,
    'baseAmount', v_catalog.monthly_price,
    'seatAmount', v_seat_amount,
    'recurringTotal', v_total,
    'paidStaffSeats', p_paid_staff_seats,
    'currency', 'BZD',
    'currentPeriodStart', v_period_start,
    'currentPeriodEnd', v_period_end,
    'status', 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_subscription_checkout_v2(
  UUID, TEXT, INTEGER, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_subscription_checkout_v2(
  UUID, TEXT, INTEGER, NUMERIC, NUMERIC, NUMERIC,
  TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_tenant_subscription_at_period_end(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant public.tenants%ROWTYPE;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tenant FROM public.tenants tenant
  WHERE tenant.id = p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found.' USING ERRCODE = 'P0002'; END IF;
  IF LOWER(COALESCE(v_tenant.subscription_status, '')) <> 'active'
     OR v_tenant.current_period_end IS NULL
     OR v_tenant.current_period_end <= NOW()
  THEN
    RAISE EXCEPTION 'This business does not have a current paid subscription to cancel.'
      USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.tenants SET
    cancel_at_period_end = TRUE,
    canceled_at = NOW(),
    subscription_updated_at = NOW(),
    updated_at = NOW()
  WHERE id = p_tenant_id;
  RETURN JSONB_BUILD_OBJECT(
    'tenantId', p_tenant_id,
    'status', 'active',
    'cancelAtPeriodEnd', TRUE,
    'currentPeriodEnd', v_tenant.current_period_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_tenant_subscription_at_period_end(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_tenant_subscription_at_period_end(UUID)
  TO service_role;

-- Safe for a scheduled job, but access is already denied by period-aware
-- entitlement checks even if this maintenance function has not run yet.
CREATE OR REPLACE FUNCTION public.expire_completed_subscription_periods()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count INTEGER;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.tenants SET
    subscription_status = CASE WHEN cancel_at_period_end THEN 'cancelled' ELSE 'expired' END,
    subscription_updated_at = NOW(),
    updated_at = NOW()
  WHERE LOWER(COALESCE(subscription_status, '')) = 'active'
    AND current_period_end IS NOT NULL
    AND current_period_end <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_completed_subscription_periods()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_completed_subscription_periods()
  TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
