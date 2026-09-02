BEGIN;

-- Additive owner tools. Existing ordering/booking functions remain available
-- so older storefront deployments continue working during rollout.

-- Keep this migration deployable on installations that predate the original
-- entitlement helper. This namespaced check mirrors the application's active
-- subscription/trial rule without replacing or renaming an existing function.
CREATE OR REPLACE FUNCTION public.growth_tools_subscription_allows_access(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE((SELECT auth.role()) = 'service_role', FALSE)
    OR EXISTS (
      SELECT 1 FROM public.profiles profile
      WHERE profile.id = (SELECT auth.uid())
        AND UPPER(COALESCE(profile.platform_role, '')) = 'SUPER_ADMIN'
    )
    OR EXISTS (
      SELECT 1 FROM public.tenants tenant
      WHERE tenant.id = p_tenant_id
        AND tenant.is_active = TRUE
        AND UPPER(tenant.status) = 'ACTIVE'
        AND (
          LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'active'
          OR (
            LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
            AND COALESCE(tenant.trial_ends_at, tenant.created_at + INTERVAL '14 days') > NOW()
          )
        )
    );
$$;
REVOKE ALL ON FUNCTION public.growth_tools_subscription_allows_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.growth_tools_subscription_allows_access(UUID) TO authenticated, service_role;

-- Service providers reuse the baseline staff/staff_services tables and the
-- existing appointments.staff_id relationship. Providers do not need logins.
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#8b5cf6',
  ADD COLUMN IF NOT EXISTS accepts_appointments BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.staff ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END;
$$;

ALTER TABLE public.staff_services
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.staff_services assignment
SET tenant_id = staff.tenant_id
FROM public.staff staff
WHERE assignment.staff_id = staff.id AND assignment.tenant_id IS NULL;

CREATE INDEX IF NOT EXISTS staff_services_tenant_idx
  ON public.staff_services (tenant_id, staff_id, service_id);

-- The original solo-business guard only allowed one appointment at a time for
-- the entire tenant. Provider businesses need one active slot per provider,
-- while bookings without a provider retain the original tenant-wide guard.
DROP INDEX IF EXISTS public.appointments_active_start_unique;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_provider_active_start_unique
  ON public.appointments (tenant_id, staff_id, starts_at)
  WHERE staff_id IS NOT NULL AND starts_at IS NOT NULL
    AND UPPER(status) NOT IN ('CANCELLED', 'NO_SHOW');
CREATE UNIQUE INDEX IF NOT EXISTS appointments_solo_active_start_unique
  ON public.appointments (tenant_id, starts_at)
  WHERE staff_id IS NULL AND starts_at IS NOT NULL
    AND UPPER(status) NOT IN ('CANCELLED', 'NO_SHOW');

CREATE TABLE IF NOT EXISTS public.staff_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, staff_id, day_of_week),
  CHECK (NOT is_available OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time))
);

-- Departments are appointment-specific service groupings. The existing
-- services.category text stays populated for backward compatibility.
CREATE TABLE IF NOT EXISTS public.service_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS service_departments_tenant_name_idx
  ON public.service_departments (tenant_id, LOWER(name));

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.service_departments(id) ON DELETE SET NULL;

INSERT INTO public.service_departments (tenant_id, name, sort_order)
SELECT service.tenant_id, BTRIM(service.category),
       ROW_NUMBER() OVER (PARTITION BY service.tenant_id ORDER BY BTRIM(service.category))::INTEGER
FROM public.services service
WHERE NULLIF(BTRIM(COALESCE(service.category, '')), '') IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE public.services service
SET department_id = department.id
FROM public.service_departments department
WHERE department.tenant_id = service.tenant_id
  AND LOWER(department.name) = LOWER(BTRIM(service.category))
  AND service.department_id IS NULL;

-- Persistent tenant notification center. Source/event uniqueness prevents
-- trigger retries from flooding a business with duplicates.
CREATE TABLE IF NOT EXISTS public.business_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ORDER', 'APPOINTMENT', 'CANCELLATION', 'LOW_INVENTORY', 'SYSTEM')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  event_key TEXT NOT NULL,
  href TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS business_notifications_source_event_idx
  ON public.business_notifications (tenant_id, source_table, source_id, event_key)
  WHERE source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS business_notifications_tenant_unread_idx
  ON public.business_notifications (tenant_id, is_read, created_at DESC);

-- Reminder configuration and delivery tracking. A future bank/email/SMS
-- provider processes PENDING rows; scheduling and status are already durable.
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS appointment_reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS appointment_reminder_minutes INTEGER[] NOT NULL DEFAULT ARRAY[1440, 120]::INTEGER[];

CREATE TABLE IF NOT EXISTS public.appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  reminder_minutes INTEGER NOT NULL CHECK (reminder_minutes BETWEEN 15 AND 10080),
  channel TEXT NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL', 'SMS')),
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appointment_id, reminder_minutes, channel)
);
CREATE INDEX IF NOT EXISTS appointment_reminders_due_idx
  ON public.appointment_reminders (status, due_at);

-- Promotions are scoped to one tenant and can target selected products or
-- services. Empty applicability arrays mean the whole storefront.
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  applicable_product_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  applicable_service_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CHECK (discount_type <> 'PERCENTAGE' OR discount_value <= 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS promotions_tenant_code_idx
  ON public.promotions (tenant_id, UPPER(code));

CREATE TABLE IF NOT EXISTS public.promotion_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE RESTRICT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  discount_amount NUMERIC(12,2) NOT NULL CHECK (discount_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((order_id IS NOT NULL)::INTEGER + (appointment_id IS NOT NULL)::INTEGER = 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS promotion_redemptions_order_idx
  ON public.promotion_redemptions (promotion_id, order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS promotion_redemptions_appointment_idx
  ON public.promotion_redemptions (promotion_id, appointment_id) WHERE appointment_id IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promotion_code TEXT,
  ADD COLUMN IF NOT EXISTS promotion_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promotion_code TEXT,
  ADD COLUMN IF NOT EXISTS promotion_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Tenant-isolated policies. Direct writes to owner configuration are owner
-- only; team members can read operational data assigned to their tenant.
DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'staff_availability', 'service_departments', 'promotions',
    'promotion_redemptions', 'appointment_reminders'
  ] LOOP
    EXECUTE FORMAT('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE FORMAT('DROP POLICY IF EXISTS growth_tools_member_read ON public.%I', v_table);
    EXECUTE FORMAT('DROP POLICY IF EXISTS growth_tools_owner_insert ON public.%I', v_table);
    EXECUTE FORMAT('DROP POLICY IF EXISTS growth_tools_owner_update ON public.%I', v_table);
    EXECUTE FORMAT('DROP POLICY IF EXISTS growth_tools_owner_delete ON public.%I', v_table);
    EXECUTE FORMAT(
      'CREATE POLICY growth_tools_member_read ON public.%I FOR SELECT TO authenticated
       USING (public.user_has_tenant_access(tenant_id))', v_table);
    EXECUTE FORMAT(
      'CREATE POLICY growth_tools_owner_insert ON public.%I FOR INSERT TO authenticated
       WITH CHECK (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin())', v_table);
    EXECUTE FORMAT(
      'CREATE POLICY growth_tools_owner_update ON public.%I FOR UPDATE TO authenticated
       USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin())
       WITH CHECK (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin())', v_table);
    EXECUTE FORMAT(
      'CREATE POLICY growth_tools_owner_delete ON public.%I FOR DELETE TO authenticated
       USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin())', v_table);
    EXECUTE FORMAT('DROP POLICY IF EXISTS growth_tools_subscription_required ON public.%I', v_table);
    EXECUTE FORMAT(
      'CREATE POLICY growth_tools_subscription_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated
       USING (public.growth_tools_subscription_allows_access(tenant_id))
       WITH CHECK (public.growth_tools_subscription_allows_access(tenant_id))', v_table);
  END LOOP;
END;
$$;

ALTER TABLE public.business_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS business_notifications_member_read ON public.business_notifications;
CREATE POLICY business_notifications_member_read ON public.business_notifications
  FOR SELECT TO authenticated USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS business_notifications_member_update ON public.business_notifications;
CREATE POLICY business_notifications_member_update ON public.business_notifications
  FOR UPDATE TO authenticated
  USING (public.user_has_tenant_access(tenant_id))
  WITH CHECK (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS business_notifications_subscription_required ON public.business_notifications;
CREATE POLICY business_notifications_subscription_required ON public.business_notifications
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.growth_tools_subscription_allows_access(tenant_id))
  WITH CHECK (public.growth_tools_subscription_allows_access(tenant_id));

REVOKE ALL ON TABLE public.business_notifications FROM anon, authenticated;
GRANT SELECT ON TABLE public.business_notifications TO authenticated;
GRANT UPDATE (is_read, read_at) ON public.business_notifications TO authenticated;

-- Owner-controlled provider records. Operational team members may read them;
-- only owners (or the platform super admin) may change them.
DROP POLICY IF EXISTS growth_tools_staff_member_read ON public.staff;
CREATE POLICY growth_tools_staff_member_read ON public.staff FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS growth_tools_staff_owner_insert ON public.staff;
CREATE POLICY growth_tools_staff_owner_insert ON public.staff FOR INSERT TO authenticated
  WITH CHECK (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());
DROP POLICY IF EXISTS growth_tools_staff_owner_update ON public.staff;
CREATE POLICY growth_tools_staff_owner_update ON public.staff FOR UPDATE TO authenticated
  USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin())
  WITH CHECK (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());
DROP POLICY IF EXISTS growth_tools_staff_owner_delete ON public.staff;
CREATE POLICY growth_tools_staff_owner_delete ON public.staff FOR DELETE TO authenticated
  USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());

DROP POLICY IF EXISTS growth_tools_staff_services_member_read ON public.staff_services;
CREATE POLICY growth_tools_staff_services_member_read ON public.staff_services FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS growth_tools_staff_services_owner_manage ON public.staff_services;
CREATE POLICY growth_tools_staff_services_owner_manage ON public.staff_services FOR ALL TO authenticated
  USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin())
  WITH CHECK (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());

-- Public read policies expose only active provider names/schedules and active
-- departments needed by the storefront; emails and phones are never selected.
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_active_providers_read ON public.staff;
CREATE POLICY public_active_providers_read ON public.staff FOR SELECT TO anon
  USING (is_active = TRUE AND accepts_appointments = TRUE AND EXISTS (
    SELECT 1 FROM public.tenants tenant
    WHERE tenant.id = staff.tenant_id AND tenant.is_active = TRUE AND tenant.status = 'ACTIVE'
  ));
ALTER TABLE public.staff_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_provider_services_read ON public.staff_services;
CREATE POLICY public_provider_services_read ON public.staff_services FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.staff provider
    WHERE provider.id = staff_services.staff_id
      AND provider.tenant_id = staff_services.tenant_id
      AND provider.is_active = TRUE AND provider.accepts_appointments = TRUE
  ));
DROP POLICY IF EXISTS public_provider_availability_read ON public.staff_availability;
CREATE POLICY public_provider_availability_read ON public.staff_availability FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.staff provider
    WHERE provider.id = staff_availability.staff_id
      AND provider.tenant_id = staff_availability.tenant_id
      AND provider.is_active = TRUE AND provider.accepts_appointments = TRUE
  ));
DROP POLICY IF EXISTS public_active_departments_read ON public.service_departments;
CREATE POLICY public_active_departments_read ON public.service_departments FOR SELECT TO anon
  USING (is_active = TRUE AND EXISTS (
    SELECT 1 FROM public.tenants tenant
    WHERE tenant.id = service_departments.tenant_id
      AND tenant.is_active = TRUE AND tenant.status = 'ACTIVE'
  ));

-- Explicit privileges complement RLS. Anonymous storefront access is limited
-- to non-sensitive provider columns; emails and phones remain private.
REVOKE ALL ON TABLE public.staff_availability, public.service_departments,
  public.promotions, public.promotion_redemptions, public.appointment_reminders FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_availability,
  public.service_departments, public.promotions, public.promotion_redemptions,
  public.appointment_reminders TO authenticated;
GRANT SELECT ON TABLE public.staff_availability, public.service_departments TO anon;
REVOKE SELECT ON TABLE public.staff FROM anon;
GRANT SELECT (id, tenant_id, display_name, bio, color, accepts_appointments, is_active)
  ON TABLE public.staff TO anon;
REVOKE SELECT ON TABLE public.staff_services FROM anon;
GRANT SELECT (tenant_id, staff_id, service_id) ON TABLE public.staff_services TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff, public.staff_services TO authenticated;

CREATE OR REPLACE FUNCTION public.save_service_provider(
  p_tenant_id UUID, p_provider_id UUID, p_name TEXT, p_email TEXT,
  p_phone TEXT, p_bio TEXT, p_color TEXT, p_is_active BOOLEAN,
  p_service_ids UUID[], p_availability JSONB
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_provider_id UUID := p_provider_id; v_requested INTEGER; v_inserted INTEGER;
BEGIN
  IF NOT (public.current_user_owns_tenant(p_tenant_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Only the business owner can manage service providers.' USING ERRCODE='42501';
  END IF;
  IF NOT public.growth_tools_subscription_allows_access(p_tenant_id) THEN
    RAISE EXCEPTION 'An active business subscription is required.' USING ERRCODE='42501';
  END IF;
  p_name:=BTRIM(COALESCE(p_name,''));
  IF LENGTH(p_name)<2 OR LENGTH(p_name)>120 THEN
    RAISE EXCEPTION 'Enter a valid provider name.' USING ERRCODE='22023';
  END IF;
  IF v_provider_id IS NULL THEN
    INSERT INTO public.staff (tenant_id,display_name,email,phone,bio,color,is_active,accepts_appointments)
    VALUES (p_tenant_id,p_name,NULLIF(LOWER(BTRIM(COALESCE(p_email,''))),''),
      NULLIF(BTRIM(COALESCE(p_phone,'')),''),NULLIF(BTRIM(COALESCE(p_bio,'')),''),
      COALESCE(NULLIF(p_color,''),'#8b5cf6'),COALESCE(p_is_active,TRUE),TRUE)
    RETURNING id INTO v_provider_id;
  ELSE
    UPDATE public.staff SET display_name=p_name,
      email=NULLIF(LOWER(BTRIM(COALESCE(p_email,''))),''),
      phone=NULLIF(BTRIM(COALESCE(p_phone,'')),''),bio=NULLIF(BTRIM(COALESCE(p_bio,'')),''),
      color=COALESCE(NULLIF(p_color,''),'#8b5cf6'),is_active=COALESCE(p_is_active,TRUE),accepts_appointments=TRUE
    WHERE id=v_provider_id AND tenant_id=p_tenant_id AND accepts_appointments=TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Service provider not found.' USING ERRCODE='P0002'; END IF;
  END IF;
  DELETE FROM public.staff_services WHERE tenant_id=p_tenant_id AND staff_id=v_provider_id;
  v_requested:=CARDINALITY(COALESCE(p_service_ids,ARRAY[]::UUID[]));
  INSERT INTO public.staff_services (tenant_id,staff_id,service_id)
  SELECT p_tenant_id,v_provider_id,service.id FROM public.services service
  WHERE service.tenant_id=p_tenant_id AND service.id=ANY(COALESCE(p_service_ids,ARRAY[]::UUID[]));
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted<>v_requested THEN RAISE EXCEPTION 'One or more assigned services are invalid.' USING ERRCODE='22023'; END IF;
  DELETE FROM public.staff_availability WHERE tenant_id=p_tenant_id AND staff_id=v_provider_id;
  INSERT INTO public.staff_availability (tenant_id,staff_id,day_of_week,start_time,end_time,is_available)
  SELECT p_tenant_id,v_provider_id,schedule.day_of_week,
    CASE WHEN schedule.is_available THEN schedule.start_time ELSE NULL END,
    CASE WHEN schedule.is_available THEN schedule.end_time ELSE NULL END,schedule.is_available
  FROM JSONB_TO_RECORDSET(COALESCE(p_availability,'[]'::JSONB)) AS schedule(
    day_of_week SMALLINT,start_time TIME,end_time TIME,is_available BOOLEAN
  );
  RETURN v_provider_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_service_provider(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,UUID[],JSONB) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_service_provider(UUID,UUID,TEXT,TEXT,TEXT,TEXT,TEXT,BOOLEAN,UUID[],JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.assign_appointment_provider(
  p_tenant_id UUID, p_appointment_id UUID, p_provider_id UUID
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_appointment public.appointments;
BEGIN
  IF NOT (public.current_user_owns_tenant(p_tenant_id) OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Only the business owner can assign providers.' USING ERRCODE='42501';
  END IF;
  IF NOT public.growth_tools_subscription_allows_access(p_tenant_id) THEN
    RAISE EXCEPTION 'An active business subscription is required.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_appointment FROM public.appointments
  WHERE id=p_appointment_id AND tenant_id=p_tenant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Appointment not found.' USING ERRCODE='P0002'; END IF;
  IF p_provider_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.staff_services assignment JOIN public.staff provider ON provider.id=assignment.staff_id
    WHERE assignment.tenant_id=p_tenant_id AND assignment.service_id=v_appointment.service_id
      AND provider.id=p_provider_id AND provider.tenant_id=p_tenant_id
      AND provider.is_active=TRUE AND provider.accepts_appointments=TRUE
  ) THEN RAISE EXCEPTION 'That provider is not assigned to this service.' USING ERRCODE='22023'; END IF;
  IF p_provider_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.appointments existing WHERE existing.tenant_id=p_tenant_id
      AND existing.staff_id=p_provider_id AND existing.id<>p_appointment_id
      AND UPPER(existing.status) NOT IN ('CANCELLED','NO_SHOW')
      AND TSTZRANGE(existing.starts_at,existing.ends_at,'[)') && TSTZRANGE(v_appointment.starts_at,v_appointment.ends_at,'[)')
  ) THEN RAISE EXCEPTION 'That provider already has an overlapping appointment.' USING ERRCODE='23505'; END IF;
  UPDATE public.appointments SET staff_id=p_provider_id WHERE id=p_appointment_id;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_appointment_provider(UUID,UUID,UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.assign_appointment_provider(UUID,UUID,UUID) TO authenticated;

-- Notification triggers.
CREATE OR REPLACE FUNCTION public.enqueue_business_activity_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status TEXT := UPPER(COALESCE(NEW.status, ''));
BEGIN
  IF TG_TABLE_NAME = 'orders' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.business_notifications
        (tenant_id, type, title, message, source_table, source_id, event_key, href)
      VALUES (NEW.tenant_id, 'ORDER', 'New order',
        'Order ' || COALESCE(NEW.order_number, '') || ' was placed by ' || COALESCE(NEW.customer_name, 'a customer') || '.',
        'orders', NEW.id, 'CREATED', '/dashboard/orders') ON CONFLICT DO NOTHING;
    ELSIF v_status = 'CANCELLED' AND UPPER(COALESCE(OLD.status, '')) <> 'CANCELLED' THEN
      INSERT INTO public.business_notifications
        (tenant_id, type, title, message, source_table, source_id, event_key, href)
      VALUES (NEW.tenant_id, 'CANCELLATION', 'Order cancelled',
        'Order ' || COALESCE(NEW.order_number, '') || ' was cancelled.',
        'orders', NEW.id, 'CANCELLED', '/dashboard/orders') ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.business_notifications
        (tenant_id, type, title, message, source_table, source_id, event_key, href)
      VALUES (NEW.tenant_id, 'APPOINTMENT', 'New appointment',
        COALESCE(NEW.customer_name, 'A customer') || ' requested an appointment.',
        'appointments', NEW.id, 'CREATED', '/dashboard/appointments') ON CONFLICT DO NOTHING;
    ELSIF v_status = 'CANCELLED' AND UPPER(COALESCE(OLD.status, '')) <> 'CANCELLED' THEN
      INSERT INTO public.business_notifications
        (tenant_id, type, title, message, source_table, source_id, event_key, href)
      VALUES (NEW.tenant_id, 'CANCELLATION', 'Appointment cancelled',
        COALESCE(NEW.customer_name, 'A customer') || '''s appointment was cancelled.',
        'appointments', NEW.id, 'CANCELLED', '/dashboard/appointments') ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_business_activity_notification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_business_order_notification ON public.orders;
CREATE TRIGGER trg_business_order_notification AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_business_activity_notification();
DROP TRIGGER IF EXISTS trg_business_appointment_notification ON public.appointments;
CREATE TRIGGER trg_business_appointment_notification AFTER INSERT OR UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_business_activity_notification();

CREATE OR REPLACE FUNCTION public.enqueue_low_inventory_notification()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF COALESCE(NEW.track_inventory, NEW.stock IS NOT NULL)
     AND NEW.stock IS NOT NULL AND NEW.stock <= 5
     AND (TG_OP = 'INSERT' OR OLD.stock IS NULL OR OLD.stock > 5 OR OLD.stock <> NEW.stock) THEN
    INSERT INTO public.business_notifications
      (tenant_id, type, title, message, source_table, source_id, event_key, href)
    VALUES (NEW.tenant_id, 'LOW_INVENTORY', 'Low inventory',
      NEW.name || ' has ' || NEW.stock || ' remaining.',
      'products', NEW.id, 'LOW_STOCK_' || NEW.stock, '/dashboard/products') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_low_inventory_notification() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_low_inventory_notification ON public.products;
CREATE TRIGGER trg_low_inventory_notification AFTER INSERT OR UPDATE OF stock ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_low_inventory_notification();

CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_enabled BOOLEAN; v_minutes INTEGER; v_values INTEGER[];
BEGIN
  IF UPPER(COALESCE(NEW.status, '')) <> 'CONFIRMED' THEN
    UPDATE public.appointment_reminders SET status = 'CANCELLED', updated_at = NOW()
    WHERE appointment_id = NEW.id AND status IN ('PENDING', 'PROCESSING');
    RETURN NEW;
  END IF;
  SELECT appointment_reminders_enabled, appointment_reminder_minutes
  INTO v_enabled, v_values FROM public.business_settings WHERE tenant_id = NEW.tenant_id;
  IF NOT COALESCE(v_enabled, TRUE) OR NEW.starts_at IS NULL THEN RETURN NEW; END IF;
  FOREACH v_minutes IN ARRAY COALESCE(v_values, ARRAY[1440,120]::INTEGER[]) LOOP
    IF NEW.starts_at - MAKE_INTERVAL(mins => v_minutes) > NOW() THEN
      INSERT INTO public.appointment_reminders
        (tenant_id, appointment_id, reminder_minutes, due_at)
      VALUES (NEW.tenant_id, NEW.id, v_minutes, NEW.starts_at - MAKE_INTERVAL(mins => v_minutes))
      ON CONFLICT (appointment_id, reminder_minutes, channel) DO UPDATE
      SET due_at = EXCLUDED.due_at,
          status = CASE WHEN public.appointment_reminders.status = 'SENT' THEN 'SENT' ELSE 'PENDING' END,
          updated_at = NOW();
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.schedule_appointment_reminders() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_schedule_appointment_reminders ON public.appointments;
CREATE TRIGGER trg_schedule_appointment_reminders
AFTER INSERT OR UPDATE OF starts_at, status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.schedule_appointment_reminders();

-- Promotion calculation is server-authoritative.
CREATE OR REPLACE FUNCTION public.calculate_promotion_discount(
  p_tenant_id UUID, p_code TEXT, p_amount NUMERIC,
  p_product_ids UUID[] DEFAULT ARRAY[]::UUID[],
  p_service_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_promo public.promotions; v_discount NUMERIC(12,2);
BEGIN
  IF NOT public.growth_tools_subscription_allows_access(p_tenant_id) THEN
    RAISE EXCEPTION 'This storefront is not accepting requests.' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_promo FROM public.promotions promotion
  WHERE promotion.tenant_id = p_tenant_id
    AND UPPER(promotion.code) = UPPER(BTRIM(COALESCE(p_code, '')))
    AND promotion.is_active = TRUE
    AND (promotion.starts_at IS NULL OR promotion.starts_at <= NOW())
    AND (promotion.ends_at IS NULL OR promotion.ends_at > NOW())
    AND (promotion.usage_limit IS NULL OR promotion.usage_count < promotion.usage_limit);
  IF NOT FOUND THEN RAISE EXCEPTION 'This discount code is invalid or expired.' USING ERRCODE = '22023'; END IF;
  IF CARDINALITY(v_promo.applicable_product_ids) > 0
     AND NOT (v_promo.applicable_product_ids && COALESCE(p_product_ids, ARRAY[]::UUID[])) THEN
    RAISE EXCEPTION 'This code does not apply to the selected products.' USING ERRCODE = '22023';
  END IF;
  IF CARDINALITY(v_promo.applicable_service_ids) > 0
     AND (p_service_id IS NULL OR NOT p_service_id = ANY(v_promo.applicable_service_ids)) THEN
    RAISE EXCEPTION 'This code does not apply to the selected service.' USING ERRCODE = '22023';
  END IF;
  v_discount := LEAST(p_amount, CASE WHEN v_promo.discount_type = 'PERCENTAGE'
    THEN ROUND(p_amount * v_promo.discount_value / 100, 2) ELSE v_promo.discount_value END);
  RETURN JSONB_BUILD_OBJECT('promotionId', v_promo.id, 'code', UPPER(v_promo.code),
    'name', v_promo.name, 'discountType', v_promo.discount_type,
    'discountValue', v_promo.discount_value, 'discountAmount', v_discount,
    'applicableProductIds', v_promo.applicable_product_ids,
    'applicableServiceIds', v_promo.applicable_service_ids);
END;
$$;
REVOKE ALL ON FUNCTION public.calculate_promotion_discount(UUID,TEXT,NUMERIC,UUID[],UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_promotion_discount(UUID,TEXT,NUMERIC,UUID[],UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_public_order_promotion(
  p_tenant_id UUID, p_order_id UUID, p_code TEXT
)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_order public.orders; v_result JSONB; v_discount NUMERIC; v_ids UUID[]; v_promo UUID;
  v_applicable UUID[]; v_eligible_amount NUMERIC;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND OR UPPER(v_order.status) <> 'PENDING' THEN RAISE EXCEPTION 'Order is not eligible for a discount.' USING ERRCODE='22023'; END IF;
  IF v_order.promotion_id IS NOT NULL THEN RETURN v_order.total; END IF;
  SELECT COALESCE(ARRAY_AGG(product_id) FILTER (WHERE product_id IS NOT NULL), ARRAY[]::UUID[])
  INTO v_ids FROM public.order_items WHERE order_id = p_order_id AND tenant_id = p_tenant_id;
  SELECT promotion.id,promotion.applicable_product_ids INTO v_promo,v_applicable FROM public.promotions promotion
  WHERE promotion.tenant_id=p_tenant_id AND UPPER(promotion.code)=UPPER(BTRIM(COALESCE(p_code,'')))
  FOR UPDATE;
  IF v_promo IS NULL THEN RAISE EXCEPTION 'This discount code is invalid or expired.' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(SUM(item.subtotal),0) INTO v_eligible_amount
  FROM public.order_items item WHERE item.order_id=p_order_id AND item.tenant_id=p_tenant_id
    AND (CARDINALITY(v_applicable)=0 OR item.product_id=ANY(v_applicable));
  IF v_eligible_amount<=0 THEN RAISE EXCEPTION 'This code does not apply to the selected products.' USING ERRCODE='22023'; END IF;
  v_result := public.calculate_promotion_discount(p_tenant_id, p_code, v_eligible_amount, v_ids, NULL);
  v_discount := (v_result->>'discountAmount')::NUMERIC;
  v_promo := (v_result->>'promotionId')::UUID;
  UPDATE public.orders SET promotion_id = v_promo, promotion_code = v_result->>'code',
    promotion_discount_amount = v_discount, total = GREATEST(total - v_discount, 0)
  WHERE id = p_order_id;
  UPDATE public.promotions SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = v_promo;
  INSERT INTO public.promotion_redemptions
    (tenant_id,promotion_id,order_id,customer_id,discount_amount)
  VALUES (p_tenant_id,v_promo,p_order_id,v_order.customer_id,v_discount);
  RETURN GREATEST(v_order.total - v_discount, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_public_order_promotion(UUID,UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_public_order_promotion(UUID,UUID,TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_public_order_with_promotion(
  p_tenant_id UUID, p_customer_name TEXT, p_customer_phone TEXT,
  p_order_type TEXT, p_items JSONB, p_notes TEXT DEFAULT NULL,
  p_promotion_code TEXT DEFAULT NULL
)
RETURNS TABLE (order_id UUID, order_number TEXT, total NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_created RECORD; v_total NUMERIC;
BEGIN
  SELECT * INTO v_created FROM public.create_public_order(
    p_tenant_id,p_customer_name,p_customer_phone,p_order_type,p_items,p_notes);
  v_total := v_created.total;
  IF NULLIF(BTRIM(COALESCE(p_promotion_code,'')),'') IS NOT NULL THEN
    v_total := public.apply_public_order_promotion(p_tenant_id,v_created.order_id,p_promotion_code);
  END IF;
  RETURN QUERY SELECT v_created.order_id::UUID,v_created.order_number::TEXT,v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.create_public_order_with_promotion(UUID,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order_with_promotion(UUID,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) TO anon, authenticated;

-- Provider-aware availability. With no provider selected, the established
-- solo-business availability function remains the source of truth.
CREATE OR REPLACE FUNCTION public.get_public_provider_availability(
  p_tenant_id UUID, p_service_id UUID, p_appointment_date DATE, p_staff_id UUID DEFAULT NULL
)
RETURNS TABLE (appointment_time TIME)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_duration INTEGER; v_timezone TEXT; v_open TIME; v_close TIME; v_closed BOOLEAN;
  v_local_now TIMESTAMP; v_has_providers BOOLEAN; v_staff_open TIME; v_staff_close TIME; v_staff_available BOOLEAN;
BEGIN
  IF NOT public.growth_tools_subscription_allows_access(p_tenant_id) THEN RETURN; END IF;
  IF p_staff_id IS NULL THEN
    RETURN QUERY SELECT available.appointment_time
    FROM public.get_public_appointment_availability(p_tenant_id,p_service_id,p_appointment_date) available;
    RETURN;
  END IF;
  SELECT service.duration_minutes INTO v_duration FROM public.services service
  WHERE service.id=p_service_id AND service.tenant_id=p_tenant_id AND service.available=TRUE;
  IF v_duration IS NULL THEN RETURN; END IF;
  SELECT EXISTS(SELECT 1 FROM public.staff_services assignment
    JOIN public.staff provider ON provider.id=assignment.staff_id
    WHERE assignment.tenant_id=p_tenant_id AND assignment.service_id=p_service_id
      AND provider.id=p_staff_id AND provider.is_active=TRUE AND provider.accepts_appointments=TRUE)
  INTO v_has_providers;
  IF NOT v_has_providers THEN RETURN; END IF;
  SELECT hours.open_time,hours.close_time,hours.is_closed INTO v_open,v_close,v_closed
  FROM public.business_hours hours WHERE hours.tenant_id=p_tenant_id
    AND hours.day_of_week=EXTRACT(DOW FROM p_appointment_date)::SMALLINT;
  IF NOT FOUND OR v_closed THEN RETURN; END IF;
  SELECT availability.start_time,availability.end_time,availability.is_available
  INTO v_staff_open,v_staff_close,v_staff_available FROM public.staff_availability availability
  WHERE availability.tenant_id=p_tenant_id AND availability.staff_id=p_staff_id
    AND availability.day_of_week=EXTRACT(DOW FROM p_appointment_date)::SMALLINT;
  IF FOUND THEN
    IF NOT v_staff_available THEN RETURN; END IF;
    v_open:=GREATEST(v_open,v_staff_open); v_close:=LEAST(v_close,v_staff_close);
  END IF;
  SELECT COALESCE(NULLIF(settings.timezone,''),'America/Belize') INTO v_timezone
  FROM public.business_settings settings WHERE settings.tenant_id=p_tenant_id;
  v_timezone:=COALESCE(v_timezone,'America/Belize'); v_local_now:=NOW() AT TIME ZONE v_timezone;
  RETURN QUERY SELECT candidate.slot::TIME FROM generate_series(
    p_appointment_date+v_open,p_appointment_date+v_close-MAKE_INTERVAL(mins=>v_duration),INTERVAL '30 minutes'
  ) candidate(slot)
  WHERE candidate.slot>v_local_now AND NOT EXISTS(
    SELECT 1 FROM public.appointments appointment WHERE appointment.tenant_id=p_tenant_id
      AND appointment.staff_id=p_staff_id AND UPPER(appointment.status) NOT IN ('CANCELLED','NO_SHOW')
      AND TSTZRANGE(appointment.starts_at,appointment.ends_at,'[)') && TSTZRANGE(
        candidate.slot AT TIME ZONE v_timezone,
        (candidate.slot+MAKE_INTERVAL(mins=>v_duration)) AT TIME ZONE v_timezone,'[)'))
  ORDER BY candidate.slot;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_provider_availability(UUID,UUID,DATE,UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_provider_availability(UUID,UUID,DATE,UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_public_appointment_promotion(
  p_tenant_id UUID, p_appointment_id UUID, p_code TEXT
)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_appointment public.appointments; v_result JSONB; v_discount NUMERIC; v_promo UUID;
BEGIN
  SELECT * INTO v_appointment FROM public.appointments
  WHERE id = p_appointment_id AND tenant_id = p_tenant_id FOR UPDATE;
  IF NOT FOUND OR UPPER(v_appointment.status) <> 'PENDING' THEN
    RAISE EXCEPTION 'Appointment is not eligible for a discount.' USING ERRCODE='22023';
  END IF;
  IF v_appointment.promotion_id IS NOT NULL THEN RETURN v_appointment.total; END IF;
  SELECT promotion.id INTO v_promo FROM public.promotions promotion
  WHERE promotion.tenant_id=p_tenant_id AND UPPER(promotion.code)=UPPER(BTRIM(COALESCE(p_code,'')))
  FOR UPDATE;
  IF v_promo IS NULL THEN RAISE EXCEPTION 'This discount code is invalid or expired.' USING ERRCODE='22023'; END IF;
  v_result := public.calculate_promotion_discount(
    p_tenant_id, p_code, COALESCE(v_appointment.subtotal, v_appointment.total),
    ARRAY[]::UUID[], v_appointment.service_id
  );
  v_discount := (v_result->>'discountAmount')::NUMERIC;
  v_promo := (v_result->>'promotionId')::UUID;
  UPDATE public.appointments
  SET promotion_id = v_promo, promotion_code = v_result->>'code',
      promotion_discount_amount = v_discount, total = GREATEST(total - v_discount, 0)
  WHERE id = p_appointment_id;
  UPDATE public.promotions SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = v_promo;
  INSERT INTO public.promotion_redemptions
    (tenant_id,promotion_id,appointment_id,customer_id,discount_amount)
  VALUES (p_tenant_id,v_promo,p_appointment_id,v_appointment.customer_id,v_discount);
  RETURN GREATEST(v_appointment.total - v_discount, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_public_appointment_promotion(UUID,UUID,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_public_appointment_promotion(UUID,UUID,TEXT) TO anon, authenticated;

-- Provider-aware public booking. Solo businesses continue through the proven
-- baseline function. Provider bookings validate tenant, assignment, business
-- hours and provider availability again inside a tenant/day transaction lock.
CREATE OR REPLACE FUNCTION public.create_public_appointment_with_provider(
  p_tenant_id UUID, p_service_id UUID, p_appointment_date DATE,
  p_appointment_time TIME, p_customer_name TEXT, p_customer_email TEXT,
  p_customer_phone TEXT, p_notes TEXT DEFAULT NULL, p_staff_id UUID DEFAULT NULL,
  p_promotion_code TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_service public.services; v_appointment_id UUID; v_customer_id UUID;
  v_first_name TEXT; v_last_name TEXT; v_timezone TEXT; v_starts_at TIMESTAMPTZ;
  v_ends_at TIMESTAMPTZ; v_deposit NUMERIC(12,2) := 0; v_slot_exists BOOLEAN;
BEGIN
  p_customer_name := BTRIM(COALESCE(p_customer_name,''));
  p_customer_email := LOWER(BTRIM(COALESCE(p_customer_email,'')));
  p_customer_phone := BTRIM(COALESCE(p_customer_phone,''));
  p_notes := NULLIF(BTRIM(COALESCE(p_notes,'')),'');
  IF LENGTH(p_customer_name) < 2 OR LENGTH(p_customer_name) > 120 THEN
    RAISE EXCEPTION 'Enter a valid customer name.' USING ERRCODE='22023';
  END IF;
  IF p_customer_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' OR LENGTH(p_customer_email)>254 THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE='22023';
  END IF;
  IF LENGTH(p_customer_phone)<7 OR LENGTH(p_customer_phone)>40 THEN
    RAISE EXCEPTION 'Enter a valid phone number.' USING ERRCODE='22023';
  END IF;
  IF p_notes IS NOT NULL AND LENGTH(p_notes)>1000 THEN
    RAISE EXCEPTION 'Booking notes cannot exceed 1000 characters.' USING ERRCODE='22023';
  END IF;

  IF p_staff_id IS NULL THEN
    v_appointment_id := public.create_public_appointment(
      p_tenant_id,p_service_id,p_appointment_date,p_appointment_time,
      p_customer_name,p_customer_email,p_customer_phone,p_notes
    );
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.tenants tenant WHERE tenant.id=p_tenant_id
      AND tenant.is_active=TRUE AND tenant.status='ACTIVE') THEN
      RAISE EXCEPTION 'This storefront is not accepting bookings.' USING ERRCODE='P0001';
    END IF;
    SELECT * INTO v_service FROM public.services service WHERE service.id=p_service_id
      AND service.tenant_id=p_tenant_id AND service.available=TRUE;
    IF NOT FOUND THEN RAISE EXCEPTION 'The selected service is unavailable.' USING ERRCODE='P0001'; END IF;

    PERFORM pg_advisory_xact_lock(hashtext(p_staff_id::TEXT),
      (p_appointment_date-DATE '2000-01-01')::INTEGER);
    SELECT EXISTS(SELECT 1 FROM public.get_public_provider_availability(
      p_tenant_id,p_service_id,p_appointment_date,p_staff_id
    ) slot WHERE slot.appointment_time=p_appointment_time) INTO v_slot_exists;
    IF NOT v_slot_exists THEN
      RAISE EXCEPTION 'That provider is not available at the selected time.' USING ERRCODE='23505';
    END IF;

    SELECT COALESCE(NULLIF(settings.timezone,''),'America/Belize') INTO v_timezone
      FROM public.business_settings settings WHERE settings.tenant_id=p_tenant_id;
    v_timezone:=COALESCE(v_timezone,'America/Belize');
    v_starts_at:=(p_appointment_date+p_appointment_time) AT TIME ZONE v_timezone;
    v_ends_at:=v_starts_at+MAKE_INTERVAL(mins=>v_service.duration_minutes);
    SELECT customer.id INTO v_customer_id FROM public.customers customer
      WHERE customer.tenant_id=p_tenant_id AND LOWER(customer.email)=p_customer_email
      ORDER BY customer.created_at LIMIT 1;
    v_first_name:=SPLIT_PART(p_customer_name,' ',1);
    v_last_name:=NULLIF(BTRIM(SUBSTRING(p_customer_name FROM LENGTH(v_first_name)+1)),'');
    IF v_customer_id IS NULL THEN
      INSERT INTO public.customers (tenant_id,first_name,last_name,email,phone,notes,is_active)
      VALUES (p_tenant_id,v_first_name,COALESCE(v_last_name,''),p_customer_email,p_customer_phone,NULL,TRUE)
      RETURNING id INTO v_customer_id;
    ELSE
      UPDATE public.customers SET first_name=v_first_name,last_name=COALESCE(v_last_name,''),
        phone=p_customer_phone,is_active=TRUE,updated_at=NOW() WHERE id=v_customer_id;
    END IF;
    IF COALESCE(v_service.requires_deposit,FALSE) THEN
      v_deposit:=CASE WHEN v_service.deposit_type='percentage'
        THEN ROUND(v_service.price*COALESCE(v_service.deposit_amount,0)/100,2)
        ELSE COALESCE(v_service.deposit_amount,0) END;
    END IF;
    INSERT INTO public.appointments (
      tenant_id,customer_id,staff_id,service_id,appointment_date,appointment_time,
      starts_at,ends_at,customer_name,customer_email,customer_phone,status,notes,
      subtotal,deposit_required,total
    ) VALUES (
      p_tenant_id,v_customer_id,p_staff_id,p_service_id,p_appointment_date,p_appointment_time,
      v_starts_at,v_ends_at,p_customer_name,p_customer_email,p_customer_phone,'PENDING',p_notes,
      v_service.price,v_deposit,v_service.price
    ) RETURNING id INTO v_appointment_id;
    INSERT INTO public.appointment_services
      (tenant_id,appointment_id,service_id,service_name,price,duration_minutes)
    VALUES (p_tenant_id,v_appointment_id,p_service_id,v_service.name,v_service.price,v_service.duration_minutes);
  END IF;
  IF NULLIF(BTRIM(COALESCE(p_promotion_code,'')),'') IS NOT NULL THEN
    PERFORM public.apply_public_appointment_promotion(p_tenant_id,v_appointment_id,p_promotion_code);
  END IF;
  RETURN v_appointment_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_public_appointment_with_provider(
  UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_appointment_with_provider(
  UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,TEXT
) TO anon, authenticated;

-- CRM aggregation uses existing customers/orders/appointments and never mixes
-- tenants. This is owner/manager-readable via normal authenticated membership.
CREATE OR REPLACE FUNCTION public.get_tenant_crm_summary(p_tenant_id UUID)
RETURNS JSONB LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_result JSONB;
BEGIN
  IF NOT public.user_has_tenant_access(p_tenant_id) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Business access required.' USING ERRCODE='42501';
  END IF;
  SELECT JSONB_BUILD_OBJECT(
    'totalCustomers',COUNT(*),
    'returningCustomers',COUNT(*) FILTER (WHERE activity_count>1),
    'averageCustomerValue',COALESCE(AVG(total_value),0),
    'customers',COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT(
      'id',id,'activityCount',activity_count,'totalValue',total_value,'lastActivity',last_activity,
      'isReturning',activity_count>1) ORDER BY last_activity DESC),'[]'::JSONB)
  ) INTO v_result FROM (
    SELECT customer.id,
      (SELECT COUNT(*) FROM public.orders o WHERE o.tenant_id=p_tenant_id AND o.customer_id=customer.id AND UPPER(o.status)<>'CANCELLED') +
      (SELECT COUNT(*) FROM public.appointments a WHERE a.tenant_id=p_tenant_id AND a.customer_id=customer.id AND UPPER(a.status)<>'CANCELLED') AS activity_count,
      COALESCE((SELECT SUM(o.total) FROM public.orders o WHERE o.tenant_id=p_tenant_id AND o.customer_id=customer.id AND UPPER(o.status) IN ('DELIVERED','COMPLETED')),0) +
      COALESCE((SELECT SUM(a.total) FROM public.appointments a WHERE a.tenant_id=p_tenant_id AND a.customer_id=customer.id AND UPPER(a.status)='COMPLETED'),0) AS total_value,
      GREATEST(
        COALESCE((SELECT MAX(o.created_at) FROM public.orders o WHERE o.tenant_id=p_tenant_id AND o.customer_id=customer.id),customer.created_at),
        COALESCE((SELECT MAX(a.starts_at) FROM public.appointments a WHERE a.tenant_id=p_tenant_id AND a.customer_id=customer.id),customer.created_at)
      ) AS last_activity
    FROM public.customers customer WHERE customer.tenant_id=p_tenant_id
  ) crm;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_tenant_crm_summary(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_crm_summary(UUID) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='business_notifications') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.business_notifications;
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
