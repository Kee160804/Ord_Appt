-- Appointment service categories are permanent catalog groupings. They are
-- deliberately separate from optional, team-plan service departments.
BEGIN;

CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS service_categories_tenant_name_idx
  ON public.service_categories (tenant_id, LOWER(BTRIM(name)));

-- Preserve every category already in use. A service without a meaningful
-- category is normalized into the safe default before the catalog is seeded.
UPDATE public.services
SET category = 'Services'
WHERE NULLIF(BTRIM(COALESCE(category, '')), '') IS NULL;

INSERT INTO public.service_categories (tenant_id, name, sort_order)
SELECT
  service.tenant_id,
  BTRIM(service.category),
  ROW_NUMBER() OVER (
    PARTITION BY service.tenant_id
    ORDER BY LOWER(BTRIM(service.category))
  )::INTEGER - 1
FROM public.services service
WHERE NULLIF(BTRIM(COALESCE(service.category, '')), '') IS NOT NULL
GROUP BY service.tenant_id, BTRIM(service.category)
ON CONFLICT DO NOTHING;

DROP TRIGGER IF EXISTS trg_service_categories_updated_at ON public.service_categories;
CREATE TRIGGER trg_service_categories_updated_at
BEFORE UPDATE ON public.service_categories
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_member_read ON public.service_categories;
CREATE POLICY service_categories_member_read ON public.service_categories
FOR SELECT TO authenticated
USING (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS service_categories_owner_insert ON public.service_categories;
CREATE POLICY service_categories_owner_insert ON public.service_categories
FOR INSERT TO authenticated
WITH CHECK (
  public.current_tenant_role(tenant_id) IN ('OWNER', 'ADMIN')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS service_categories_owner_update ON public.service_categories;
CREATE POLICY service_categories_owner_update ON public.service_categories
FOR UPDATE TO authenticated
USING (
  public.current_tenant_role(tenant_id) IN ('OWNER', 'ADMIN')
  OR public.is_super_admin()
)
WITH CHECK (
  public.current_tenant_role(tenant_id) IN ('OWNER', 'ADMIN')
  OR public.is_super_admin()
);

DROP POLICY IF EXISTS service_categories_owner_delete ON public.service_categories;
CREATE POLICY service_categories_owner_delete ON public.service_categories
FOR DELETE TO authenticated
USING (
  public.current_tenant_role(tenant_id) IN ('OWNER', 'ADMIN')
  OR public.is_super_admin()
);

REVOKE ALL ON TABLE public.service_categories FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.service_categories TO authenticated;

-- A service category must always exist in the tenant's category catalog.
CREATE OR REPLACE FUNCTION public.enforce_service_category_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_category_name TEXT;
BEGIN
  SELECT name INTO v_category_name
  FROM public.service_categories
  WHERE tenant_id = NEW.tenant_id
    AND LOWER(BTRIM(name)) = LOWER(BTRIM(COALESCE(NEW.category, '')))
  LIMIT 1;

  IF v_category_name IS NULL THEN
    RAISE EXCEPTION 'Choose a valid service category.' USING ERRCODE = '23503';
  END IF;
  NEW.category := v_category_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_require_category ON public.services;
CREATE TRIGGER trg_services_require_category
BEFORE INSERT OR UPDATE OF category ON public.services
FOR EACH ROW EXECUTE FUNCTION public.enforce_service_category_assignment();

-- Department assignment is an administrative action even when other team
-- roles can edit ordinary service details.
CREATE OR REPLACE FUNCTION public.enforce_service_department_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role() = 'service_role', FALSE)
     OR public.is_super_admin()
     OR public.current_tenant_role(NEW.tenant_id) IN ('OWNER', 'ADMIN')
  THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.department_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only a business owner or admin can assign a department.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    RAISE EXCEPTION 'Only a business owner or admin can assign a department.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_services_department_admin ON public.services;
CREATE TRIGGER trg_services_department_admin
BEFORE INSERT OR UPDATE OF department_id ON public.services
FOR EACH ROW EXECUTE FUNCTION public.enforce_service_department_admin();

-- Rename the catalog entry and all assigned services in one transaction.
CREATE OR REPLACE FUNCTION public.rename_service_category(
  p_tenant_id UUID,
  p_category_id UUID,
  p_name TEXT
)
RETURNS public.service_categories
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_name TEXT;
  v_name TEXT := BTRIM(COALESCE(p_name, ''));
  v_category public.service_categories;
BEGIN
  IF NOT (
    public.current_tenant_role(p_tenant_id) IN ('OWNER', 'ADMIN')
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'Only a business owner or admin can manage service categories.'
      USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Category name is required.' USING ERRCODE = '22023';
  END IF;

  SELECT name INTO v_old_name
  FROM public.service_categories
  WHERE id = p_category_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service category not found.' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.service_categories
  SET name = v_name
  WHERE id = p_category_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_category;

  UPDATE public.services
  SET category = v_name
  WHERE tenant_id = p_tenant_id
    AND LOWER(BTRIM(category)) = LOWER(BTRIM(v_old_name));

  RETURN v_category;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_service_category(
  p_tenant_id UUID,
  p_category_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_name TEXT;
BEGIN
  IF NOT (
    public.current_tenant_role(p_tenant_id) IN ('OWNER', 'ADMIN')
    OR public.is_super_admin()
  ) THEN
    RAISE EXCEPTION 'Only a business owner or admin can manage service categories.'
      USING ERRCODE = '42501';
  END IF;

  SELECT name INTO v_name
  FROM public.service_categories
  WHERE id = p_category_id AND tenant_id = p_tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Service category not found.' USING ERRCODE = 'P0002';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.services
    WHERE tenant_id = p_tenant_id
      AND LOWER(BTRIM(category)) = LOWER(BTRIM(v_name))
  ) THEN
    RAISE EXCEPTION 'Move services to another category before deleting this category.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.service_categories
  WHERE id = p_category_id AND tenant_id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_service_category(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_service_category(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rename_service_category(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_service_category(UUID, UUID) TO authenticated;

COMMIT;
