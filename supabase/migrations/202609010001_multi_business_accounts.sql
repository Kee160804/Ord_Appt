BEGIN;

-- One profile/Auth user can belong to many tenants. Memberships are the
-- authorization source of truth; profiles.tenant_id remains untouched only
-- for compatibility with older installations.
CREATE INDEX IF NOT EXISTS tenant_memberships_profile_active_idx
  ON public.tenant_memberships (profile_id, is_active, tenant_id);

CREATE OR REPLACE FUNCTION public.user_has_tenant_access(requested_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships AS membership
    JOIN public.profiles AS profile
      ON profile.id = membership.profile_id
    WHERE membership.profile_id = auth.uid()
      AND membership.tenant_id = requested_tenant_id
      AND membership.is_active = TRUE
      AND profile.is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.user_has_tenant_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_tenant_access(UUID) TO authenticated;

-- Explicit policies let a user enumerate every business they belong to. All
-- business data policies continue to call user_has_tenant_access(tenant_id),
-- so adding a membership grants access only to that exact tenant.
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS multi_business_memberships_select ON public.tenant_memberships;
CREATE POLICY multi_business_memberships_select
  ON public.tenant_memberships
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS multi_business_tenants_select ON public.tenants;
CREATE POLICY multi_business_tenants_select
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(id));

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS multi_business_roles_select ON public.roles;
CREATE POLICY multi_business_roles_select
  ON public.roles
  FOR SELECT
  TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

-- Some older baseline projects scoped their permissive policies through the
-- legacy profiles.tenant_id column. Install membership-based policies for the
-- complete business dataset so second and later businesses work identically
-- on those projects. The existing restrictive subscription policy still
-- applies to every read/write and therefore cannot be bypassed here.
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
    'business_reviews',
    'order_status_history',
    'order_email_deliveries'
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
      EXECUTE FORMAT('DROP POLICY IF EXISTS multi_business_tenant_access ON public.%I', v_table);
      EXECUTE FORMAT(
        'CREATE POLICY multi_business_tenant_access
         ON public.%I
         FOR ALL
         TO authenticated
         USING (public.user_has_tenant_access(tenant_id))
         WITH CHECK (public.user_has_tenant_access(tenant_id))',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

DROP POLICY IF EXISTS multi_business_tenants_update ON public.tenants;
CREATE POLICY multi_business_tenants_update
  ON public.tenants
  FOR UPDATE
  TO authenticated
  USING (public.user_has_tenant_access(id))
  WITH CHECK (public.user_has_tenant_access(id));

CREATE OR REPLACE FUNCTION public.create_additional_owner_business(
  p_business_name TEXT,
  p_business_type TEXT,
  p_city TEXT DEFAULT '',
  p_phone TEXT DEFAULT '',
  p_slug TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_role_id UUID;
  v_slug_base TEXT;
  v_slug TEXT;
  v_attempt INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Your application profile is not active.' USING ERRCODE = '42501';
  END IF;

  IF LENGTH(BTRIM(COALESCE(p_business_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Business name is required.' USING ERRCODE = '22023';
  END IF;

  IF LOWER(COALESCE(p_business_type, '')) NOT IN ('appointment', 'ordering') THEN
    RAISE EXCEPTION 'Choose a valid business type.' USING ERRCODE = '22023';
  END IF;

  v_slug_base := LOWER(REGEXP_REPLACE(
    BTRIM(COALESCE(NULLIF(p_slug, ''), p_business_name)),
    '[^a-zA-Z0-9]+', '-', 'g'
  ));
  v_slug_base := REGEXP_REPLACE(v_slug_base, '(^-+|-+$)', '', 'g');
  IF v_slug_base = '' THEN v_slug_base := 'business'; END IF;

  -- Prevent two simultaneous requests for the same account from creating
  -- duplicate businesses. Slug collisions across accounts are retried below.
  PERFORM pg_advisory_xact_lock(hashtext('additional-business:' || v_user_id::TEXT));

  LOOP
    v_slug := CASE
      WHEN v_attempt = 0 THEN v_slug_base
      ELSE v_slug_base || '-' || LEFT(REPLACE(gen_random_uuid()::TEXT, '-', ''), 7)
    END;

    BEGIN
      INSERT INTO public.tenants (
        business_name,
        slug,
        subdomain,
        business_type,
        city,
        phone,
        email,
        created_by,
        status,
        is_active,
        plan,
        subscription_status,
        trial_ends_at
      )
      SELECT
        BTRIM(p_business_name),
        v_slug,
        v_slug,
        LOWER(p_business_type),
        BTRIM(COALESCE(p_city, '')),
        BTRIM(COALESCE(p_phone, '')),
        auth_user.email,
        v_user_id,
        'ACTIVE',
        TRUE,
        'starter',
        'trial',
        NOW() + INTERVAL '14 days'
      FROM auth.users AS auth_user
      WHERE auth_user.id = v_user_id
      RETURNING id INTO v_tenant_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt >= 5 THEN
        RAISE EXCEPTION 'Unable to generate a unique storefront address. Try another address.'
          USING ERRCODE = '23505';
      END IF;
    END;
  END LOOP;

  -- Foundational tenant triggers may have already created OWNER and the first
  -- membership. Reuse those rows when present and fill them in when absent.
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE tenant_id = v_tenant_id AND UPPER(name) = 'OWNER'
  LIMIT 1;

  IF v_role_id IS NULL THEN
    INSERT INTO public.roles (tenant_id, name, description, is_system_role)
    VALUES (v_tenant_id, 'OWNER', 'Business owner', TRUE)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_role_id
    FROM public.roles
    WHERE tenant_id = v_tenant_id AND UPPER(name) = 'OWNER'
    LIMIT 1;
  END IF;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Unable to create the owner role.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tenant_memberships (tenant_id, profile_id, role_id, is_active)
  VALUES (v_tenant_id, v_user_id, v_role_id, TRUE)
  ON CONFLICT ON CONSTRAINT tenant_memberships_tenant_id_profile_id_key DO UPDATE
  SET role_id = EXCLUDED.role_id,
      is_active = TRUE;

  UPDATE public.business_modules
  SET appointments = LOWER(p_business_type) = 'appointment',
      ordering = LOWER(p_business_type) = 'ordering',
      inventory = LOWER(p_business_type) = 'ordering'
  WHERE tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO public.business_modules (tenant_id, appointments, ordering, inventory)
    VALUES (
      v_tenant_id,
      LOWER(p_business_type) = 'appointment',
      LOWER(p_business_type) = 'ordering',
      LOWER(p_business_type) = 'ordering'
    );
  END IF;

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_additional_owner_business(TEXT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_additional_owner_business(TEXT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
