BEGIN;

-- These policies were added for signed-in storefront visitors, but permissive
-- RLS policies are ORed together and therefore exposed every active catalog to
-- every tenant user. Public storefront rendering now deliberately uses the
-- anonymous role, so authenticated users retain only the baseline
-- membership-scoped policies.
DROP POLICY IF EXISTS public_tenants_select_authenticated_policy ON public.tenants;
DROP POLICY IF EXISTS public_settings_select_authenticated_policy ON public.business_settings;
DROP POLICY IF EXISTS public_hours_select_authenticated_policy ON public.business_hours;
DROP POLICY IF EXISTS public_categories_select_authenticated_policy ON public.categories;
DROP POLICY IF EXISTS public_products_select_authenticated_policy ON public.products;
DROP POLICY IF EXISTS public_services_select_authenticated_policy ON public.services;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

COMMIT;
