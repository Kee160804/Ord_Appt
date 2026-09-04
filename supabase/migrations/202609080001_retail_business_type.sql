BEGIN;

-- Extend existing installations beyond the original appointment/ordering model.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint AS con
    JOIN pg_class AS rel ON rel.oid = con.conrelid
    JOIN pg_namespace AS namespace ON namespace.oid = rel.relnamespace
    WHERE namespace.nspname = 'public'
      AND rel.relname = 'tenants'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%business_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS %I', constraint_name);
  END LOOP;
END;
$$;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_business_type_check
  CHECK (LOWER(business_type) IN ('appointment', 'ordering', 'retail'));

NOTIFY pgrst, 'reload schema';

COMMIT;
