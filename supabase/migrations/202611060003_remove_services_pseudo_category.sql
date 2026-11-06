-- "All" is the catch-all storefront tab. "Services" is not a category and
-- must not appear in the owner category catalog.
BEGIN;

DELETE FROM public.service_categories
WHERE LOWER(BTRIM(name)) = 'services';

COMMIT;
