BEGIN;

-- Forward-only repair for projects that already applied the original owner
-- onboarding migration. Some foundational schemas initialize an OWNER
-- membership from trg_initialize_new_tenant; other schemas do not. This RPC
-- supports both arrangements and remains safe under retries.
CREATE OR REPLACE FUNCTION public.provision_owner_business(
  p_business_name TEXT,
  p_business_type TEXT,
  p_city TEXT,
  p_phone TEXT,
  p_slug TEXT,
  p_full_name TEXT
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
  v_slug TEXT := LOWER(REGEXP_REPLACE(BTRIM(COALESCE(p_slug, p_business_name)), '[^a-zA-Z0-9]+', '-', 'g'));
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in.' USING ERRCODE = '28000'; END IF;
  IF LENGTH(BTRIM(COALESCE(p_business_name, ''))) < 2 THEN RAISE EXCEPTION 'Business name is required.' USING ERRCODE = '22023'; END IF;
  IF LOWER(COALESCE(p_business_type, '')) NOT IN ('appointment', 'ordering', 'retail') THEN RAISE EXCEPTION 'Choose a valid business type.' USING ERRCODE = '22023'; END IF;
  v_slug := REGEXP_REPLACE(v_slug, '(^-+|-+$)', '', 'g');
  IF v_slug = '' THEN v_slug := 'business-' || LEFT(REPLACE(v_user_id::TEXT, '-', ''), 12); END IF;

  -- Serialize provisioning attempts made by login hydration and auth events.
  PERFORM pg_advisory_xact_lock(hashtext(v_user_id::TEXT));

  INSERT INTO public.profiles (id, full_name, email, is_active)
  SELECT v_user_id, BTRIM(p_full_name), email, TRUE
  FROM auth.users
  WHERE id = v_user_id
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      updated_at = NOW();

  -- A completed prior attempt is returned instead of provisioning twice.
  SELECT tenant_id INTO v_tenant_id
  FROM public.tenant_memberships
  WHERE profile_id = v_user_id
    AND is_active = TRUE
  ORDER BY joined_at
  LIMIT 1;
  IF v_tenant_id IS NOT NULL THEN RETURN v_tenant_id; END IF;

  IF EXISTS (SELECT 1 FROM public.tenants WHERE LOWER(slug) = LOWER(v_slug)) THEN
    v_slug := v_slug || '-' || LEFT(REPLACE(v_user_id::TEXT, '-', ''), 8);
  END IF;

  INSERT INTO public.tenants (
    business_name, slug, subdomain, business_type, city, phone, email,
    created_by, status, is_active
  )
  SELECT
    BTRIM(p_business_name), v_slug, v_slug, LOWER(p_business_type),
    BTRIM(COALESCE(p_city, '')), BTRIM(COALESCE(p_phone, '')), email,
    v_user_id, 'ACTIVE', TRUE
  FROM auth.users
  WHERE id = v_user_id
  RETURNING id INTO v_tenant_id;

  -- trg_initialize_new_tenant may already have created OWNER and its
  -- membership. Ensure OWNER exists, then reuse any trigger-created row.
  SELECT id INTO v_role_id
  FROM public.roles
  WHERE tenant_id = v_tenant_id
    AND UPPER(name) = 'OWNER'
  LIMIT 1;

  IF v_role_id IS NULL THEN
    INSERT INTO public.roles (tenant_id, name, description, is_system_role)
    VALUES (v_tenant_id, 'OWNER', 'Business owner', TRUE)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_role_id
    FROM public.roles
    WHERE tenant_id = v_tenant_id
      AND UPPER(name) = 'OWNER'
    LIMIT 1;
  END IF;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Unable to create the owner role.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tenant_memberships
  SET role_id = v_role_id,
      is_active = TRUE
  WHERE tenant_id = v_tenant_id
    AND profile_id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.tenant_memberships (tenant_id, profile_id, role_id, is_active)
    VALUES (v_tenant_id, v_user_id, v_role_id, TRUE)
    ON CONFLICT ON CONSTRAINT tenant_memberships_tenant_id_profile_id_key DO UPDATE
    SET role_id = EXCLUDED.role_id,
        is_active = TRUE;
  END IF;

  UPDATE public.business_modules
  SET appointments = LOWER(p_business_type) = 'appointment',
      ordering = LOWER(p_business_type) = 'ordering',
      inventory = LOWER(p_business_type) IN ('ordering', 'retail')
  WHERE tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    INSERT INTO public.business_modules (tenant_id, appointments, ordering, inventory)
    VALUES (
      v_tenant_id,
      LOWER(p_business_type) = 'appointment',
      LOWER(p_business_type) = 'ordering',
      LOWER(p_business_type) IN ('ordering', 'retail')
    );
  END IF;

  RETURN v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_owner_business(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_owner_business(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
