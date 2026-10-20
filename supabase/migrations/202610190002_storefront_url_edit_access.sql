-- Storefront addresses are reserved during onboarding. Business owners can
-- change them only after a platform administrator explicitly grants access.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS allow_storefront_url_edit BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.guard_tenant_storefront_url_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_is_platform_admin BOOLEAN :=
    COALESCE((SELECT auth.role()) = 'service_role', FALSE)
    OR (SELECT public.is_super_admin());
BEGIN
  IF NEW.allow_storefront_url_edit IS DISTINCT FROM OLD.allow_storefront_url_edit
     AND v_is_platform_admin = FALSE THEN
    RAISE EXCEPTION 'Only a platform administrator can change storefront URL access.'
      USING ERRCODE = '42501';
  END IF;

  IF (
    NEW.slug IS DISTINCT FROM OLD.slug
    OR NEW.subdomain IS DISTINCT FROM OLD.subdomain
    OR NEW.custom_domain IS DISTINCT FROM OLD.custom_domain
  )
  AND v_is_platform_admin = FALSE
  AND OLD.allow_storefront_url_edit = FALSE THEN
    RAISE EXCEPTION 'Storefront URL changes require platform administrator approval.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.custom_domain_verified_at IS DISTINCT FROM OLD.custom_domain_verified_at
     AND v_is_platform_admin = FALSE THEN
    RAISE EXCEPTION 'Only a platform administrator can verify storefront domains.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_tenant_storefront_url_fields ON public.tenants;
CREATE TRIGGER trg_guard_tenant_storefront_url_fields
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.guard_tenant_storefront_url_fields();
