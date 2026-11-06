-- Remove the legacy overlap where appointment department names were also used
-- as service categories. Department assignments remain unchanged.
BEGIN;

INSERT INTO public.service_categories (tenant_id, name, sort_order)
SELECT DISTINCT
  service.tenant_id,
  'Services',
  COALESCE((
    SELECT MAX(category.sort_order) + 1
    FROM public.service_categories category
    WHERE category.tenant_id = service.tenant_id
  ), 0)
FROM public.services service
JOIN public.service_departments department
  ON department.tenant_id = service.tenant_id
 AND LOWER(BTRIM(department.name)) = LOWER(BTRIM(service.category))
ON CONFLICT DO NOTHING;

UPDATE public.services service
SET category = 'Services'
FROM public.service_departments department
WHERE department.tenant_id = service.tenant_id
  AND LOWER(BTRIM(department.name)) = LOWER(BTRIM(service.category));

DELETE FROM public.service_categories category
USING public.service_departments department
WHERE department.tenant_id = category.tenant_id
  AND LOWER(BTRIM(department.name)) = LOWER(BTRIM(category.name));

COMMIT;
