BEGIN;

-- The public storefront is rendered by trusted server code. Browser clients
-- must never be able to enumerate base tables through PostgREST, even when a
-- row is suitable for display on one known storefront.
DO $block$
DECLARE
  v_table RECORD;
  v_policy RECORD;
BEGIN
  FOR v_table IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE FORMAT(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      v_table.schema_name,
      v_table.table_name
    );
    EXECUTE FORMAT(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM anon',
      v_table.schema_name,
      v_table.table_name
    );
  END LOOP;

  -- Remove obsolete policies aimed at anonymous/public roles. PostgreSQL ORs
  -- permissive policies, so leaving one behind can silently reopen a table
  -- when somebody later restores a SELECT grant.
  FOR v_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
  LOOP
    EXECUTE FORMAT(
      'DROP POLICY %I ON %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  END LOOP;
END;
$block$;

REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- Functions are executable by PUBLIC unless explicitly revoked. Default-deny
-- both PUBLIC and anon; authenticated/service_role grants created by earlier
-- migrations remain explicit and unaffected.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- These storefront functions were historically callable from browsers. All
-- now run behind bounded/rate-limited server routes, including for signed-in
-- users, so a newly registered account cannot use RPC as an alternate public
-- data API.
REVOKE EXECUTE ON FUNCTION public.get_public_appointment_availability(UUID, UUID, DATE)
  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_public_provider_availability(UUID, UUID, DATE, UUID)
  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.list_public_storefront_promotions(UUID)
  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_storefront_contact_message(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_promotion_discount(UUID, TEXT, NUMERIC, UUID[], UUID)
  FROM authenticated;

-- Prevent future migrations from accidentally publishing newly created
-- tables, sequences, or functions through PostgreSQL's default privileges.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;

NOTIFY pgrst, 'reload schema';

COMMIT;
