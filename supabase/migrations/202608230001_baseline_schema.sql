BEGIN;

-- Canonical baseline for a brand-new Supabase project. Every later migration
-- in this repository is additive and can be applied after this file in order.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END;
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID,
  full_name TEXT,
  email TEXT,
  role TEXT,
  platform_role TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  slug TEXT NOT NULL,
  subdomain TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT 'appointment',
  description TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  logo TEXT,
  logo_url TEXT,
  logo_bg TEXT,
  cover_image TEXT,
  primary_color TEXT DEFAULT '#8b5cf6',
  accent_color TEXT DEFAULT '#a78bfa',
  plan TEXT NOT NULL DEFAULT 'starter',
  stripe_connected BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (LOWER(business_type) IN ('appointment','ordering'))
);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tenant_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_unique ON public.tenants (LOWER(slug));
CREATE UNIQUE INDEX IF NOT EXISTS tenants_subdomain_unique ON public.tenants (LOWER(subdomain));

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, profile_id)
);

CREATE OR REPLACE FUNCTION public.user_has_tenant_access(requested_tenant_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_memberships m JOIN public.profiles p ON p.id=m.profile_id
    WHERE m.profile_id=auth.uid() AND m.tenant_id=requested_tenant_id AND m.is_active AND p.is_active);
$$;
REVOKE ALL ON FUNCTION public.user_has_tenant_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_tenant_access(UUID) TO authenticated;

CREATE TABLE IF NOT EXISTS public.business_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  timezone TEXT NOT NULL DEFAULT 'America/Belize',
  currency TEXT NOT NULL DEFAULT 'BZD',
  locale TEXT NOT NULL DEFAULT 'en-BZ',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.business_modules (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointments BOOLEAN NOT NULL DEFAULT TRUE,
  ordering BOOLEAN NOT NULL DEFAULT FALSE,
  inventory BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL, name TEXT NOT NULL, description TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0), image_url TEXT, sku TEXT, stock INTEGER,
  available BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT, duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0), image_url TEXT, available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.staff_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, service_id)
);
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '', last_name TEXT NOT NULL DEFAULT '', email TEXT, phone TEXT, notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS customers_tenant_email_idx ON public.customers (tenant_id, LOWER(email));
CREATE INDEX IF NOT EXISTS customers_tenant_phone_idx ON public.customers (tenant_id, phone);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL, order_number TEXT NOT NULL,
  customer_name TEXT, customer_email TEXT, customer_phone TEXT, status TEXT NOT NULL DEFAULT 'PENDING',
  payment_status TEXT NOT NULL DEFAULT 'UNPAID', total NUMERIC(12,2) NOT NULL DEFAULT 0, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_number_idx ON public.orders (tenant_id, order_number);
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE, product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0), unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL, staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL, appointment_date DATE, appointment_time TIME,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, customer_name TEXT, customer_email TEXT, customer_phone TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', notes TEXT, subtotal NUMERIC(12,2), deposit_required NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2), payment_status TEXT NOT NULL DEFAULT 'UNPAID', cancelled_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL, service_name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL, duration_minutes INTEGER NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.business_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL, rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT, body TEXT, is_published BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.initialize_new_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, pg_temp AS $$
DECLARE v_role UUID; v_day INTEGER;
BEGIN
  INSERT INTO public.business_settings (tenant_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.business_modules (tenant_id,appointments,ordering,inventory)
    VALUES (NEW.id,LOWER(NEW.business_type)='appointment',LOWER(NEW.business_type)='ordering',LOWER(NEW.business_type)='ordering') ON CONFLICT DO NOTHING;
  FOR v_day IN 0..6 LOOP INSERT INTO public.business_hours (tenant_id,day_of_week,open_time,close_time,is_closed)
    VALUES (NEW.id,v_day,'09:00','17:00',v_day IN (0,6)) ON CONFLICT DO NOTHING; END LOOP;
  INSERT INTO public.roles (tenant_id,name,description,is_system_role) VALUES (NEW.id,'OWNER','Business owner',TRUE)
    ON CONFLICT DO NOTHING RETURNING id INTO v_role;
  IF v_role IS NULL THEN SELECT id INTO v_role FROM public.roles WHERE tenant_id=NEW.id AND name='OWNER'; END IF;
  IF NEW.created_by IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE id=NEW.created_by) THEN
    INSERT INTO public.tenant_memberships (tenant_id,profile_id,role_id,is_active) VALUES (NEW.id,NEW.created_by,v_role,TRUE) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_initialize_new_tenant ON public.tenants;
CREATE TRIGGER trg_initialize_new_tenant AFTER INSERT ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.initialize_new_tenant();

DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['profiles','tenants','roles','tenant_memberships','business_settings','business_modules','business_hours','categories','products','services','staff','staff_services','customers','orders','order_items','appointments','appointment_services','business_reviews']
  LOOP EXECUTE FORMAT('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',table_name); END LOOP;
END $$;

CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated USING (id=auth.uid());
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (id=auth.uid()) WITH CHECK (id=auth.uid());
CREATE POLICY memberships_self_select ON public.tenant_memberships FOR SELECT TO authenticated USING (profile_id=auth.uid());
CREATE POLICY tenant_member_access ON public.tenants FOR ALL TO authenticated USING (public.user_has_tenant_access(id)) WITH CHECK (public.user_has_tenant_access(id));
CREATE POLICY roles_member_access ON public.roles FOR ALL TO authenticated USING (public.user_has_tenant_access(tenant_id)) WITH CHECK (public.user_has_tenant_access(tenant_id));
DO $$ DECLARE table_name TEXT; BEGIN
  FOREACH table_name IN ARRAY ARRAY['business_settings','business_modules','business_hours','categories','products','services','staff','customers','orders','order_items','appointments','appointment_services','business_reviews'] LOOP
    EXECUTE FORMAT('CREATE POLICY tenant_member_access ON public.%I FOR ALL TO authenticated USING (public.user_has_tenant_access(tenant_id)) WITH CHECK (public.user_has_tenant_access(tenant_id))',table_name);
  END LOOP;
END $$;
CREATE POLICY staff_services_member_access ON public.staff_services FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.staff s WHERE s.id=staff_id AND public.user_has_tenant_access(s.tenant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff s WHERE s.id=staff_id AND public.user_has_tenant_access(s.tenant_id)));

CREATE POLICY public_active_tenants ON public.tenants FOR SELECT TO anon USING (is_active AND UPPER(status)='ACTIVE');
CREATE POLICY public_active_settings ON public.business_settings FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.is_active AND UPPER(t.status)='ACTIVE'));
CREATE POLICY public_active_hours ON public.business_hours FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.is_active AND UPPER(t.status)='ACTIVE'));
CREATE POLICY public_active_categories ON public.categories FOR SELECT TO anon USING (is_active AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.is_active AND UPPER(t.status)='ACTIVE'));
CREATE POLICY public_active_products ON public.products FOR SELECT TO anon USING (available AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.is_active AND UPPER(t.status)='ACTIVE'));
CREATE POLICY public_active_services ON public.services FOR SELECT TO anon USING (available AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.is_active AND UPPER(t.status)='ACTIVE'));
CREATE POLICY public_active_staff ON public.staff FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.tenants t WHERE t.id=tenant_id AND t.is_active AND UPPER(t.status)='ACTIVE'));
CREATE POLICY public_staff_services ON public.staff_services FOR SELECT TO anon USING (TRUE);
CREATE POLICY public_reviews ON public.business_reviews FOR SELECT TO anon USING (is_published);

GRANT SELECT ON public.tenants,public.business_settings,public.business_modules,public.business_hours,public.categories,public.products,public.services,public.staff,public.staff_services,public.business_reviews TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

COMMIT;
