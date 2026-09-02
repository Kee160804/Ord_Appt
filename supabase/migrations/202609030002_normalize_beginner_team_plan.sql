BEGIN;

-- Older projects may contain the public plan label `beginner` even though the
-- application and entitlement migrations use `starter` as the internal key.
-- This is an alias normalization only; price, subscription status, trial dates,
-- activity limits, memberships, and business data remain unchanged.
UPDATE public.tenants
SET plan = 'starter'
WHERE LOWER(COALESCE(plan::TEXT, '')) = 'beginner';

ALTER TABLE public.tenants
  ALTER COLUMN plan SET DEFAULT 'starter';

NOTIFY pgrst, 'reload schema';

COMMIT;
