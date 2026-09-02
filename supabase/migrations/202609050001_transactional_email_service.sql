BEGIN;

-- Some established YuhBusiness databases predate the dedicated order and
-- appointment email migrations. Create those queues here as compatibility
-- prerequisites so this migration can be applied directly and safely.
CREATE TABLE IF NOT EXISTS public.order_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT 'Customer',
  subject TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  processing_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.order_email_deliveries
  ADD COLUMN IF NOT EXISTS recipient_name TEXT NOT NULL DEFAULT 'Customer',
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Order update',
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS order_email_delivery_event_unique_idx
  ON public.order_email_deliveries (order_id, event_type);
CREATE INDEX IF NOT EXISTS order_email_delivery_status_idx
  ON public.order_email_deliveries (status, created_at);

CREATE TABLE IF NOT EXISTS public.appointment_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL DEFAULT 'APPOINTMENT_CONFIRMED',
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT 'Customer',
  subject TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error TEXT,
  processing_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.appointment_email_deliveries
  ADD COLUMN IF NOT EXISTS recipient_name TEXT NOT NULL DEFAULT 'Customer',
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Appointment update',
  ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS appointment_email_delivery_event_unique_idx
  ON public.appointment_email_deliveries (appointment_id, event_type);
CREATE INDEX IF NOT EXISTS appointment_email_delivery_status_idx
  ON public.appointment_email_deliveries (status, created_at);

-- Central outbox for transactional events that do not already have a durable
-- order/appointment delivery record. Resend is called only by trusted server
-- code; database transactions only enqueue work.
CREATE TABLE IF NOT EXISTS public.transactional_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'WELCOME_ACCOUNT', 'BUSINESS_CREATED', 'TEAM_INVITATION',
    'APPOINTMENT_CANCELLED', 'CONTACT_FORM_MESSAGE',
    'TRIAL_EXPIRING', 'TRIAL_EXPIRED', 'SUBSCRIPTION_ACTIVATED',
    'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION_PAYMENT_ISSUE', 'BUSINESS_ALERT'
  )),
  source_table TEXT NOT NULL CHECK (source_table IN (
    'tenants', 'tenant_memberships', 'team_invitations', 'appointments',
    'storefront_contact_messages', 'business_notifications'
  )),
  source_id UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL DEFAULT 'there',
  subject TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  provider_message_id TEXT,
  last_error TEXT,
  processing_started_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS transactional_email_delivery_status_idx
  ON public.transactional_email_deliveries (status, created_at);

ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_provider_message_id TEXT;

-- Existing delivery tables remain the source of truth for order and confirmed
-- appointment emails. CANCELLED means the worker intentionally skipped a
-- stale/invalid recipient rather than retrying it forever.
ALTER TABLE public.appointment_email_deliveries
  DROP CONSTRAINT IF EXISTS appointment_email_status_check;
ALTER TABLE public.appointment_email_deliveries
  ADD CONSTRAINT appointment_email_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'));
ALTER TABLE public.order_email_deliveries
  DROP CONSTRAINT IF EXISTS order_email_deliveries_status_check;
ALTER TABLE public.order_email_deliveries
  ADD CONSTRAINT order_email_deliveries_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED'));

DROP TRIGGER IF EXISTS trg_order_email_deliveries_updated_at ON public.order_email_deliveries;
CREATE TRIGGER trg_order_email_deliveries_updated_at
BEFORE UPDATE ON public.order_email_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_appointment_email_deliveries_updated_at ON public.appointment_email_deliveries;
CREATE TRIGGER trg_appointment_email_deliveries_updated_at
BEFORE UPDATE ON public.appointment_email_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_email_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactional_order_email_owner_read ON public.order_email_deliveries;
CREATE POLICY transactional_order_email_owner_read ON public.order_email_deliveries
  FOR SELECT TO authenticated
  USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());
DROP POLICY IF EXISTS transactional_appointment_email_owner_read ON public.appointment_email_deliveries;
CREATE POLICY transactional_appointment_email_owner_read ON public.appointment_email_deliveries
  FOR SELECT TO authenticated
  USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());
REVOKE ALL ON TABLE public.order_email_deliveries, public.appointment_email_deliveries FROM anon, authenticated;
GRANT SELECT ON TABLE public.order_email_deliveries, public.appointment_email_deliveries TO authenticated;
GRANT ALL ON TABLE public.order_email_deliveries, public.appointment_email_deliveries TO service_role;

-- Reinstall the established queue triggers as non-blocking functions. They
-- intentionally use only the long-standing order/appointment columns so they
-- also work on databases that did not receive the later operations migration.
CREATE OR REPLACE FUNCTION public.enqueue_order_status_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event TEXT; v_tenant public.tenants%ROWTYPE; v_items JSONB; v_subject TEXT;
BEGIN
  IF NULLIF(BTRIM(COALESCE(NEW.customer_email,'')),'') IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  v_event:=CASE UPPER(COALESCE(NEW.status,''))
    WHEN 'PENDING' THEN 'ORDER_RECEIVED' WHEN 'CONFIRMED' THEN 'ORDER_ACCEPTED'
    WHEN 'PREPARING' THEN 'ORDER_PREPARING' WHEN 'READY' THEN 'ORDER_READY'
    WHEN 'OUT_FOR_DELIVERY' THEN 'ORDER_OUT_FOR_DELIVERY'
    WHEN 'DELIVERED' THEN 'ORDER_COMPLETED' WHEN 'COMPLETED' THEN 'ORDER_COMPLETED'
    WHEN 'CANCELLED' THEN 'ORDER_CANCELLED' ELSE NULL END;
  IF v_event IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=NEW.tenant_id;
  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('name',item.product_name,'quantity',item.quantity,
    'unit_price',item.unit_price,'subtotal',item.subtotal) ORDER BY item.created_at),'[]'::JSONB)
  INTO v_items FROM public.order_items item WHERE item.order_id=NEW.id;
  v_subject:=CASE v_event WHEN 'ORDER_RECEIVED' THEN 'We received order '
    WHEN 'ORDER_ACCEPTED' THEN 'Order accepted - ' WHEN 'ORDER_PREPARING' THEN 'Preparing order '
    WHEN 'ORDER_READY' THEN 'Order ready - ' WHEN 'ORDER_OUT_FOR_DELIVERY' THEN 'Order on the way - '
    WHEN 'ORDER_COMPLETED' THEN 'Order complete - ' ELSE 'Order cancelled - ' END || NEW.order_number;
  BEGIN
    INSERT INTO public.order_email_deliveries
      (tenant_id,order_id,event_type,recipient_email,recipient_name,subject,payload)
    VALUES (NEW.tenant_id,NEW.id,v_event,LOWER(NEW.customer_email),
      COALESCE(NULLIF(BTRIM(NEW.customer_name),''),'Customer'),v_subject,
      JSONB_BUILD_OBJECT('business_name',v_tenant.business_name,'business_email',v_tenant.email,
        'business_phone',v_tenant.phone,'order_number',NEW.order_number,'total',NEW.total,'items',v_items))
    ON CONFLICT (order_id,event_type) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Order saved but status email enqueue failed: %',SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_order_status_email() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_order_status_email ON public.orders;
CREATE CONSTRAINT TRIGGER trg_enqueue_order_status_email
AFTER INSERT OR UPDATE OF status ON public.orders DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_status_email();

CREATE OR REPLACE FUNCTION public.enqueue_appointment_confirmation_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant public.tenants%ROWTYPE; v_service_name TEXT; v_timezone TEXT;
BEGIN
  IF UPPER(COALESCE(NEW.status,''))<>'CONFIRMED'
     OR UPPER(COALESCE(OLD.status,''))='CONFIRMED'
     OR NULLIF(BTRIM(COALESCE(NEW.customer_email,'')),'') IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=NEW.tenant_id;
  SELECT appointment_service.service_name INTO v_service_name
    FROM public.appointment_services appointment_service
    WHERE appointment_service.appointment_id=NEW.id ORDER BY appointment_service.created_at LIMIT 1;
  IF v_service_name IS NULL AND NEW.service_id IS NOT NULL THEN
    SELECT service.name INTO v_service_name FROM public.services service
      WHERE service.id=NEW.service_id AND service.tenant_id=NEW.tenant_id;
  END IF;
  SELECT COALESCE(NULLIF(settings.timezone,''),'America/Belize') INTO v_timezone
    FROM public.business_settings settings WHERE settings.tenant_id=NEW.tenant_id;
  BEGIN
    INSERT INTO public.appointment_email_deliveries
      (tenant_id,appointment_id,event_type,recipient_email,recipient_name,subject,payload)
    VALUES (NEW.tenant_id,NEW.id,'APPOINTMENT_CONFIRMED',LOWER(NEW.customer_email),
      COALESCE(NULLIF(BTRIM(NEW.customer_name),''),'Customer'),
      'Your appointment with '||COALESCE(v_tenant.business_name,'YuhBusiness')||' is confirmed',
      JSONB_BUILD_OBJECT('business_name',v_tenant.business_name,'business_email',v_tenant.email,
        'business_phone',v_tenant.phone,'service_name',COALESCE(v_service_name,'Appointment'),
        'starts_at',NEW.starts_at,'appointment_date',NEW.appointment_date,
        'appointment_time',NEW.appointment_time,'timezone',COALESCE(v_timezone,'America/Belize'),
        'confirmation_code',UPPER(LEFT(NEW.id::TEXT,8))))
    ON CONFLICT (appointment_id,event_type) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Appointment confirmed but email enqueue failed: %',SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_appointment_confirmation_email() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_appointment_confirmation_email ON public.appointments;
CREATE TRIGGER trg_enqueue_appointment_confirmation_email
AFTER UPDATE OF status ON public.appointments FOR EACH ROW
EXECUTE FUNCTION public.enqueue_appointment_confirmation_email();

DROP TRIGGER IF EXISTS trg_transactional_email_updated_at ON public.transactional_email_deliveries;
CREATE TRIGGER trg_transactional_email_updated_at
BEFORE UPDATE ON public.transactional_email_deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transactional_email_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS transactional_email_owner_read ON public.transactional_email_deliveries;
CREATE POLICY transactional_email_owner_read ON public.transactional_email_deliveries
  FOR SELECT TO authenticated
  USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());
REVOKE ALL ON TABLE public.transactional_email_deliveries FROM anon, authenticated;
GRANT SELECT ON TABLE public.transactional_email_deliveries TO authenticated;
GRANT ALL ON TABLE public.transactional_email_deliveries TO service_role;

-- Storefront messages remain tenant-owned CRM activity. Anonymous users can
-- submit only through the validated/rate-limited function below.
CREATE TABLE IF NOT EXISTS public.storefront_contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'READ', 'ARCHIVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS storefront_contact_messages_tenant_idx
  ON public.storefront_contact_messages (tenant_id, created_at DESC);
DROP TRIGGER IF EXISTS trg_storefront_contact_messages_updated_at ON public.storefront_contact_messages;
CREATE TRIGGER trg_storefront_contact_messages_updated_at
BEFORE UPDATE ON public.storefront_contact_messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.storefront_contact_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS storefront_contact_messages_owner_read ON public.storefront_contact_messages;
CREATE POLICY storefront_contact_messages_owner_read ON public.storefront_contact_messages
  FOR SELECT TO authenticated
  USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());
DROP POLICY IF EXISTS storefront_contact_messages_owner_update ON public.storefront_contact_messages;
CREATE POLICY storefront_contact_messages_owner_update ON public.storefront_contact_messages
  FOR UPDATE TO authenticated
  USING (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin())
  WITH CHECK (public.current_user_owns_tenant(tenant_id) OR public.is_super_admin());
REVOKE ALL ON TABLE public.storefront_contact_messages FROM anon, authenticated;
GRANT SELECT, UPDATE (status, updated_at) ON public.storefront_contact_messages TO authenticated;
GRANT ALL ON TABLE public.storefront_contact_messages TO service_role;

CREATE OR REPLACE FUNCTION public.transactional_email_owner(p_tenant_id UUID)
RETURNS TABLE (email TEXT, full_name TEXT)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT profile.email, COALESCE(NULLIF(BTRIM(profile.full_name), ''), SPLIT_PART(profile.email, '@', 1))
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id AND role.tenant_id = membership.tenant_id
  JOIN public.profiles profile ON profile.id = membership.profile_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.is_active = TRUE
    AND profile.is_active = TRUE
    AND UPPER(role.name) = 'OWNER'
    AND profile.email IS NOT NULL
  ORDER BY membership.joined_at
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.transactional_email_owner(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transactional_email_owner(UUID) TO service_role;

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
    AND public.growth_tools_subscription_allows_access(tenant.id)
    AND (
      LOWER(COALESCE(tenant.subscription_status, 'trial')) = 'trial'
      OR LOWER(COALESCE(tenant.plan, 'starter')) IN ('pro', 'enterprise')
    );
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
REVOKE ALL ON FUNCTION public.submit_storefront_contact_message(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_storefront_contact_message(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- Welcome and business-created emails follow the authoritative membership,
-- so one Auth user with several businesses receives one account welcome and a
-- separate business-created notice for each tenant.
CREATE OR REPLACE FUNCTION public.enqueue_membership_transactional_emails()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_tenant public.tenants%ROWTYPE; v_role TEXT; v_membership_count INTEGER;
BEGIN
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.profile_id;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = NEW.tenant_id;
  SELECT UPPER(role.name) INTO v_role FROM public.roles role
    WHERE role.id = NEW.role_id AND role.tenant_id = NEW.tenant_id;
  IF v_profile.email IS NULL OR v_tenant.id IS NULL THEN RETURN NEW; END IF;

  SELECT COUNT(*)::INTEGER INTO v_membership_count
  FROM public.tenant_memberships membership
  WHERE membership.profile_id = NEW.profile_id AND membership.is_active = TRUE;

  BEGIN
    IF v_membership_count = 1 THEN
      INSERT INTO public.transactional_email_deliveries (
        tenant_id,event_type,source_table,source_id,recipient_email,recipient_name,subject,payload,idempotency_key
      ) VALUES (
        NEW.tenant_id,'WELCOME_ACCOUNT','tenant_memberships',NEW.id,LOWER(v_profile.email),
        COALESCE(NULLIF(BTRIM(v_profile.full_name),''),SPLIT_PART(v_profile.email,'@',1)),
        'Welcome to YuhBusiness',JSONB_BUILD_OBJECT('business_name',v_tenant.business_name),
        'welcome-account/' || NEW.profile_id::TEXT
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
    IF v_role = 'OWNER' THEN
      INSERT INTO public.transactional_email_deliveries (
        tenant_id,event_type,source_table,source_id,recipient_email,recipient_name,subject,payload,idempotency_key
      ) VALUES (
        NEW.tenant_id,'BUSINESS_CREATED','tenant_memberships',NEW.id,LOWER(v_profile.email),
        COALESCE(NULLIF(BTRIM(v_profile.full_name),''),SPLIT_PART(v_profile.email,'@',1)),
        v_tenant.business_name || ' is ready on YuhBusiness',
        JSONB_BUILD_OBJECT('business_name',v_tenant.business_name,'plan',v_tenant.plan,
          'trial_ends_at',v_tenant.trial_ends_at),
        'business-created/' || NEW.tenant_id::TEXT
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Membership saved but transactional email enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_membership_transactional_emails() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_membership_transactional_emails ON public.tenant_memberships;
CREATE TRIGGER trg_enqueue_membership_transactional_emails
AFTER INSERT ON public.tenant_memberships FOR EACH ROW
EXECUTE FUNCTION public.enqueue_membership_transactional_emails();

CREATE OR REPLACE FUNCTION public.enqueue_subscription_transactional_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner RECORD; v_event TEXT; v_subject TEXT;
BEGIN
  IF NEW.plan IS NOT DISTINCT FROM OLD.plan
     AND NEW.subscription_status IS NOT DISTINCT FROM OLD.subscription_status
     AND NEW.trial_ends_at IS NOT DISTINCT FROM OLD.trial_ends_at THEN RETURN NEW; END IF;
  SELECT * INTO v_owner FROM public.transactional_email_owner(NEW.id);
  IF v_owner.email IS NULL THEN RETURN NEW; END IF;
  v_event := CASE
    WHEN LOWER(COALESCE(NEW.subscription_status,'trial')) = 'active' AND LOWER(COALESCE(OLD.subscription_status,'')) <> 'active'
      THEN 'SUBSCRIPTION_ACTIVATED'
    WHEN LOWER(COALESCE(NEW.subscription_status,'trial')) IN ('past_due','cancelled')
      THEN 'SUBSCRIPTION_PAYMENT_ISSUE'
    ELSE 'SUBSCRIPTION_UPDATED' END;
  v_subject := NEW.business_name || ' subscription ' || REPLACE(LOWER(COALESCE(NEW.subscription_status,'trial')),'_',' ');
  BEGIN
    INSERT INTO public.transactional_email_deliveries (
      tenant_id,event_type,source_table,source_id,recipient_email,recipient_name,subject,payload,idempotency_key
    ) VALUES (
      NEW.id,v_event,'tenants',NEW.id,LOWER(v_owner.email),v_owner.full_name,v_subject,
      JSONB_BUILD_OBJECT('business_name',NEW.business_name,'plan',NEW.plan,
        'subscription_status',NEW.subscription_status,'trial_ends_at',NEW.trial_ends_at),
      'subscription/' || NEW.id::TEXT || '/' || REPLACE(LOWER(COALESCE(NEW.subscription_status,'trial')),'_','-') || '/' || COALESCE(NEW.updated_at,NOW())::TEXT
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Subscription updated but email enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_subscription_transactional_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_subscription_transactional_email ON public.tenants;
CREATE TRIGGER trg_enqueue_subscription_transactional_email
AFTER UPDATE OF plan, subscription_status, trial_ends_at ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.enqueue_subscription_transactional_email();

CREATE OR REPLACE FUNCTION public.enqueue_appointment_cancellation_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant public.tenants%ROWTYPE; v_service_name TEXT; v_timezone TEXT;
BEGIN
  IF UPPER(COALESCE(NEW.status,'')) <> 'CANCELLED'
     OR UPPER(COALESCE(OLD.status,'')) = 'CANCELLED'
     OR NULLIF(BTRIM(COALESCE(NEW.customer_email,'')),'') IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=NEW.tenant_id;
  SELECT appointment_service.service_name INTO v_service_name
    FROM public.appointment_services appointment_service
    WHERE appointment_service.appointment_id=NEW.id ORDER BY appointment_service.created_at LIMIT 1;
  SELECT COALESCE(NULLIF(settings.timezone,''),'America/Belize') INTO v_timezone
    FROM public.business_settings settings WHERE settings.tenant_id=NEW.tenant_id;
  BEGIN
    INSERT INTO public.transactional_email_deliveries (
      tenant_id,event_type,source_table,source_id,recipient_email,recipient_name,subject,payload,idempotency_key
    ) VALUES (
      NEW.tenant_id,'APPOINTMENT_CANCELLED','appointments',NEW.id,LOWER(NEW.customer_email),
      COALESCE(NULLIF(BTRIM(NEW.customer_name),''),'Customer'),
      'Appointment cancelled - ' || COALESCE(v_tenant.business_name,'YuhBusiness'),
      JSONB_BUILD_OBJECT('business_name',v_tenant.business_name,'business_email',v_tenant.email,
        'business_phone',v_tenant.phone,'service_name',COALESCE(v_service_name,'Appointment'),
        'starts_at',NEW.starts_at,'timezone',COALESCE(v_timezone,'America/Belize'),
        'cancellation_reason',''),
      'appointment-cancelled/' || NEW.id::TEXT
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Appointment cancelled but email enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_appointment_cancellation_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_appointment_cancellation_email ON public.appointments;
CREATE TRIGGER trg_enqueue_appointment_cancellation_email
AFTER UPDATE OF status ON public.appointments FOR EACH ROW
EXECUTE FUNCTION public.enqueue_appointment_cancellation_email();

-- Important in-app alerts also get an email channel. Orders/appointments stay
-- in the existing notification center and are included as business activity.
CREATE OR REPLACE FUNCTION public.enqueue_business_alert_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner RECORD; v_tenant public.tenants%ROWTYPE;
BEGIN
  IF NEW.source_table = 'storefront_contact_messages' THEN RETURN NEW; END IF;
  SELECT * INTO v_owner FROM public.transactional_email_owner(NEW.tenant_id);
  SELECT * INTO v_tenant FROM public.tenants WHERE id=NEW.tenant_id;
  IF v_owner.email IS NULL THEN RETURN NEW; END IF;
  BEGIN
    INSERT INTO public.transactional_email_deliveries (
      tenant_id,event_type,source_table,source_id,recipient_email,recipient_name,subject,payload,idempotency_key
    ) VALUES (
      NEW.tenant_id,'BUSINESS_ALERT','business_notifications',NEW.id,LOWER(v_owner.email),
      v_owner.full_name,NEW.title,JSONB_BUILD_OBJECT('business_name',v_tenant.business_name,
        'title',NEW.title,'message',NEW.message,'href',NEW.href,'notification_type',NEW.type),
      'business-alert/' || NEW.id::TEXT
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'In-app notification saved but email enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_business_alert_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_business_alert_email ON public.business_notifications;
CREATE TRIGGER trg_enqueue_business_alert_email
AFTER INSERT ON public.business_notifications FOR EACH ROW
EXECUTE FUNCTION public.enqueue_business_alert_email();

-- Backward-compatible checkout wrapper adds the customer email required for
-- receipts while reusing the existing pricing, promotion, stock and order RPCs.
CREATE OR REPLACE FUNCTION public.create_public_order_with_email(
  p_tenant_id UUID, p_customer_name TEXT, p_customer_email TEXT,
  p_customer_phone TEXT, p_order_type TEXT, p_items JSONB,
  p_notes TEXT DEFAULT NULL, p_promotion_code TEXT DEFAULT NULL
)
RETURNS TABLE (order_id UUID, order_number TEXT, total NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_created RECORD; v_email TEXT := LOWER(BTRIM(COALESCE(p_customer_email,'')));
BEGIN
  IF LENGTH(v_email)>254 OR v_email !~* '^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Enter a valid email address.' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_created FROM public.create_public_order_with_promotion(
    p_tenant_id,p_customer_name,p_customer_phone,p_order_type,p_items,p_notes,p_promotion_code);
  UPDATE public.orders SET customer_email=v_email
    WHERE id=v_created.order_id AND tenant_id=p_tenant_id;
  UPDATE public.customers SET email=v_email,updated_at=NOW()
    WHERE id=(SELECT customer_id FROM public.orders WHERE id=v_created.order_id AND tenant_id=p_tenant_id)
      AND tenant_id=p_tenant_id;
  RETURN QUERY SELECT v_created.order_id::UUID,v_created.order_number::TEXT,v_created.total::NUMERIC;
END;
$$;
REVOKE ALL ON FUNCTION public.create_public_order_with_email(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_order_with_email(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_order_received_after_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_tenant public.tenants%ROWTYPE; v_items JSONB;
BEGIN
  IF NULLIF(BTRIM(COALESCE(OLD.customer_email,'')),'') IS NOT NULL
     OR NULLIF(BTRIM(COALESCE(NEW.customer_email,'')),'') IS NULL
     OR UPPER(COALESCE(NEW.status,'')) <> 'PENDING' THEN RETURN NEW; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=NEW.tenant_id;
  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('name',item.product_name,'quantity',item.quantity,
    'unit_price',item.unit_price,'subtotal',item.subtotal) ORDER BY item.created_at),'[]'::JSONB)
  INTO v_items FROM public.order_items item WHERE item.order_id=NEW.id;
  BEGIN
    INSERT INTO public.order_email_deliveries
      (tenant_id,order_id,event_type,recipient_email,recipient_name,subject,payload)
    VALUES (NEW.tenant_id,NEW.id,'ORDER_RECEIVED',LOWER(NEW.customer_email),
      COALESCE(NULLIF(BTRIM(NEW.customer_name),''),'Customer'),'We received order '||NEW.order_number,
      JSONB_BUILD_OBJECT('business_name',v_tenant.business_name,'business_email',v_tenant.email,
        'business_phone',v_tenant.phone,'order_number',NEW.order_number,
        'total',NEW.total,'items',v_items))
    ON CONFLICT (order_id,event_type) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Order saved but confirmation email enqueue failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_order_received_after_email() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_enqueue_order_received_after_email ON public.orders;
CREATE TRIGGER trg_enqueue_order_received_after_email
AFTER UPDATE OF customer_email ON public.orders FOR EACH ROW
EXECUTE FUNCTION public.enqueue_order_received_after_email();

-- Time-based trial events are created by the secure worker immediately before
-- it claims delivery jobs. Unique keys make repeated schedules harmless.
CREATE OR REPLACE FUNCTION public.enqueue_due_trial_emails()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count INTEGER := 0; v_row RECORD;
BEGIN
  IF COALESCE((SELECT auth.role()),'') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE='42501'; END IF;
  FOR v_row IN
    SELECT tenant.*,owner.email AS owner_email,owner.full_name AS owner_name
    FROM public.tenants tenant
    CROSS JOIN LATERAL public.transactional_email_owner(tenant.id) owner
    WHERE LOWER(COALESCE(tenant.subscription_status,'trial'))='trial'
      AND tenant.trial_ends_at IS NOT NULL
      AND tenant.trial_ends_at <= NOW()+INTERVAL '3 days'
  LOOP
    INSERT INTO public.transactional_email_deliveries
      (tenant_id,event_type,source_table,source_id,recipient_email,recipient_name,subject,payload,idempotency_key)
    VALUES (v_row.id,CASE WHEN v_row.trial_ends_at<=NOW() THEN 'TRIAL_EXPIRED' ELSE 'TRIAL_EXPIRING' END,
      'tenants',v_row.id,LOWER(v_row.owner_email),v_row.owner_name,
      CASE WHEN v_row.trial_ends_at<=NOW() THEN v_row.business_name||'''s trial has ended'
        ELSE v_row.business_name||'''s trial is ending soon' END,
      JSONB_BUILD_OBJECT('business_name',v_row.business_name,'plan',v_row.plan,'trial_ends_at',v_row.trial_ends_at),
      CASE WHEN v_row.trial_ends_at<=NOW() THEN 'trial-expired/' ELSE 'trial-expiring/' END
        ||v_row.id::TEXT||'/'||v_row.trial_ends_at::DATE::TEXT)
    ON CONFLICT (idempotency_key) DO NOTHING;
    IF FOUND THEN v_count:=v_count+1; END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_due_trial_emails() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_due_trial_emails() TO service_role;

-- One atomic claim function leases all established email queues. SKIP LOCKED,
-- a retry cap, and stale-lease recovery make overlapping cron/webhook calls safe.
CREATE OR REPLACE FUNCTION public.claim_email_jobs(p_limit INTEGER DEFAULT 30)
RETURNS SETOF JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_row RECORD; v_claimed INTEGER:=0; v_limit INTEGER:=LEAST(GREATEST(COALESCE(p_limit,30),1),100);
BEGIN
  IF COALESCE((SELECT auth.role()),'') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE='42501'; END IF;

  UPDATE public.transactional_email_deliveries SET status='FAILED',processing_started_at=NULL,
    last_error='Processing lease expired.',updated_at=NOW()
  WHERE status='PROCESSING' AND processing_started_at<NOW()-INTERVAL '15 minutes' AND attempt_count<3;
  UPDATE public.order_email_deliveries SET status='FAILED',processing_started_at=NULL,
    last_error='Processing lease expired.',updated_at=NOW()
  WHERE status='PROCESSING' AND processing_started_at<NOW()-INTERVAL '15 minutes' AND attempt_count<3;
  UPDATE public.appointment_email_deliveries SET status='FAILED',processing_started_at=NULL,
    last_error='Processing lease expired.',updated_at=NOW()
  WHERE status='PROCESSING' AND processing_started_at<NOW()-INTERVAL '15 minutes' AND attempt_count<3;
  UPDATE public.appointment_reminders SET status='FAILED',updated_at=NOW()
  WHERE status='PROCESSING' AND updated_at<NOW()-INTERVAL '15 minutes' AND attempt_count<3;

  FOR v_row IN SELECT delivery.* FROM public.transactional_email_deliveries delivery
    WHERE delivery.status IN ('PENDING','FAILED') AND delivery.attempt_count<3
    ORDER BY delivery.created_at LIMIT v_limit FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.transactional_email_deliveries SET status='PROCESSING',attempt_count=attempt_count+1,
      processing_started_at=NOW(),last_error=NULL WHERE id=v_row.id;
    v_claimed:=v_claimed+1;
    RETURN NEXT JSONB_BUILD_OBJECT('queue_name','transactional','id',v_row.id,'tenant_id',v_row.tenant_id,
      'source_table',v_row.source_table,'source_id',v_row.source_id,'event_type',v_row.event_type,
      'recipient_email',v_row.recipient_email,'recipient_name',v_row.recipient_name,'subject',v_row.subject,
      'payload',v_row.payload,'idempotency_key',v_row.idempotency_key,'attempt_count',v_row.attempt_count+1);
  END LOOP;

  IF v_claimed<v_limit THEN FOR v_row IN SELECT delivery.* FROM public.order_email_deliveries delivery
    WHERE delivery.status IN ('PENDING','FAILED') AND delivery.attempt_count<3
    ORDER BY delivery.created_at LIMIT (v_limit-v_claimed) FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.order_email_deliveries SET status='PROCESSING',attempt_count=attempt_count+1,
      processing_started_at=NOW(),last_error=NULL WHERE id=v_row.id;
    v_claimed:=v_claimed+1;
    RETURN NEXT JSONB_BUILD_OBJECT('queue_name','order','id',v_row.id,'tenant_id',v_row.tenant_id,
      'source_table','orders','source_id',v_row.order_id,'event_type',v_row.event_type,
      'recipient_email',v_row.recipient_email,'recipient_name',v_row.recipient_name,'subject',v_row.subject,
      'payload',v_row.payload,'idempotency_key','order/'||v_row.order_id::TEXT||'/'||LOWER(v_row.event_type),
      'attempt_count',v_row.attempt_count+1);
  END LOOP; END IF;

  IF v_claimed<v_limit THEN FOR v_row IN SELECT delivery.* FROM public.appointment_email_deliveries delivery
    WHERE delivery.status IN ('PENDING','FAILED') AND delivery.attempt_count<3
    ORDER BY delivery.created_at LIMIT (v_limit-v_claimed) FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.appointment_email_deliveries SET status='PROCESSING',attempt_count=attempt_count+1,
      processing_started_at=NOW(),last_error=NULL WHERE id=v_row.id;
    v_claimed:=v_claimed+1;
    RETURN NEXT JSONB_BUILD_OBJECT('queue_name','appointment','id',v_row.id,'tenant_id',v_row.tenant_id,
      'source_table','appointments','source_id',v_row.appointment_id,'event_type',v_row.event_type,
      'recipient_email',v_row.recipient_email,'recipient_name',v_row.recipient_name,'subject',v_row.subject,
      'payload',v_row.payload,'idempotency_key','appointment/'||v_row.appointment_id::TEXT||'/'||LOWER(v_row.event_type),
      'attempt_count',v_row.attempt_count+1);
  END LOOP; END IF;

  IF v_claimed<v_limit THEN FOR v_row IN
    SELECT reminder.*,appointment.customer_email,appointment.customer_name
    FROM public.appointment_reminders reminder JOIN public.appointments appointment
      ON appointment.id=reminder.appointment_id AND appointment.tenant_id=reminder.tenant_id
    WHERE reminder.channel='EMAIL' AND reminder.due_at<=NOW()
      AND reminder.status IN ('PENDING','FAILED') AND reminder.attempt_count<3
      AND UPPER(appointment.status)='CONFIRMED'
      AND NULLIF(BTRIM(COALESCE(appointment.customer_email,'')),'') IS NOT NULL
    ORDER BY reminder.due_at LIMIT (v_limit-v_claimed) FOR UPDATE OF reminder SKIP LOCKED
  LOOP
    UPDATE public.appointment_reminders SET status='PROCESSING',attempt_count=attempt_count+1,
      last_error=NULL,updated_at=NOW() WHERE id=v_row.id;
    v_claimed:=v_claimed+1;
    RETURN NEXT JSONB_BUILD_OBJECT('queue_name','reminder','id',v_row.id,'tenant_id',v_row.tenant_id,
      'source_table','appointments','source_id',v_row.appointment_id,'event_type','APPOINTMENT_REMINDER',
      'recipient_email',LOWER(v_row.customer_email),'recipient_name',COALESCE(NULLIF(BTRIM(v_row.customer_name),''),'Customer'),
      'subject','Appointment reminder','payload',JSONB_BUILD_OBJECT('reminder_minutes',v_row.reminder_minutes),
      'idempotency_key','appointment-reminder/'||v_row.id::TEXT,'attempt_count',v_row.attempt_count+1);
  END LOOP; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_email_jobs(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_jobs(INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION public.mark_email_job_result(
  p_queue_name TEXT,p_job_id UUID,p_status TEXT,p_provider_message_id TEXT DEFAULT NULL,p_error TEXT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status TEXT:=UPPER(COALESCE(p_status,''));
BEGIN
  IF COALESCE((SELECT auth.role()),'') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE='42501'; END IF;
  IF v_status NOT IN ('SENT','FAILED','CANCELLED') THEN
    RAISE EXCEPTION 'Invalid delivery result.' USING ERRCODE='22023'; END IF;
  IF p_queue_name='transactional' THEN
    UPDATE public.transactional_email_deliveries SET status=v_status,provider_message_id=p_provider_message_id,
      last_error=p_error,processing_started_at=NULL,sent_at=CASE WHEN v_status='SENT' THEN NOW() ELSE sent_at END,updated_at=NOW()
      WHERE id=p_job_id AND status='PROCESSING';
  ELSIF p_queue_name='order' THEN
    UPDATE public.order_email_deliveries SET status=v_status,provider_message_id=p_provider_message_id,
      last_error=p_error,processing_started_at=NULL,sent_at=CASE WHEN v_status='SENT' THEN NOW() ELSE sent_at END,updated_at=NOW()
      WHERE id=p_job_id AND status='PROCESSING';
  ELSIF p_queue_name='appointment' THEN
    UPDATE public.appointment_email_deliveries SET status=v_status,provider_message_id=p_provider_message_id,
      last_error=p_error,processing_started_at=NULL,sent_at=CASE WHEN v_status='SENT' THEN NOW() ELSE sent_at END,updated_at=NOW()
      WHERE id=p_job_id AND status='PROCESSING';
  ELSIF p_queue_name='reminder' THEN
    UPDATE public.appointment_reminders SET status=v_status,provider_message_id=p_provider_message_id,
      last_error=p_error,sent_at=CASE WHEN v_status='SENT' THEN NOW() ELSE sent_at END,updated_at=NOW()
      WHERE id=p_job_id AND status='PROCESSING';
  ELSE RAISE EXCEPTION 'Unknown email queue.' USING ERRCODE='22023'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_email_job_result(TEXT,UUID,TEXT,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_email_job_result(TEXT,UUID,TEXT,TEXT,TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
