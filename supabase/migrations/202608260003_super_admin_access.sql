BEGIN;

-- Platform authorization is stored in profiles, not user-editable Auth
-- metadata. Individual SUPER_ADMIN assignments remain an explicit SQL/admin
-- operation and are intentionally not hardcoded in this migration.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = (SELECT auth.uid())
      AND UPPER(profile.platform_role) = 'SUPER_ADMIN'
      AND profile.is_active = TRUE
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Prevent browser clients from promoting themselves even if a baseline
-- profile policy permits users to edit their own contact information.
CREATE OR REPLACE FUNCTION public.guard_profile_platform_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_trusted_executor BOOLEAN :=
    current_user IN ('postgres', 'supabase_admin', 'service_role')
    OR public.is_super_admin();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF UPPER(COALESCE(NEW.platform_role, '')) = 'SUPER_ADMIN'
       AND NOT v_trusted_executor THEN
      RAISE EXCEPTION 'Only a platform administrator can assign SUPER_ADMIN.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.platform_role IS DISTINCT FROM OLD.platform_role
        AND NOT v_trusted_executor THEN
    RAISE EXCEPTION 'You cannot modify your platform role.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_platform_role_trigger ON public.profiles;
CREATE TRIGGER guard_profile_platform_role_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_platform_role();

DO $$
DECLARE
  v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'profiles',
    'tenants',
    'tenant_memberships',
    'roles',
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
    'appointment_email_deliveries',
    'business_reviews'
  ]
  LOOP
    IF TO_REGCLASS(FORMAT('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE FORMAT('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS super_admin_all_access ON public.%I',
        v_table
      );
      EXECUTE FORMAT(
        'CREATE POLICY super_admin_all_access
         ON public.%I
         FOR ALL
         TO authenticated
         USING ((SELECT public.is_super_admin()))
         WITH CHECK ((SELECT public.is_super_admin()))',
        v_table
      );
      EXECUTE FORMAT(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
