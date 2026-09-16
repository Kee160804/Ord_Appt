BEGIN;

-- Account deletion should preserve historical team records without retaining a
-- hard dependency on a profile that no longer exists. This also allows the
-- auth.users -> profiles ON DELETE CASCADE relationship to complete reliably.
ALTER TABLE public.team_invitations
  ALTER COLUMN invited_by DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS team_invitations_invited_by_fkey;

ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_invited_by_fkey
  FOREIGN KEY (invited_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

ALTER TABLE public.tenant_seat_change_requests
  ALTER COLUMN requested_by DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS tenant_seat_change_requests_requested_by_fkey;

ALTER TABLE public.tenant_seat_change_requests
  ADD CONSTRAINT tenant_seat_change_requests_requested_by_fkey
  FOREIGN KEY (requested_by)
  REFERENCES public.profiles(id)
  ON DELETE SET NULL;

-- Reassert the canonical one-way lifecycle: deleting an Auth identity removes
-- its application profile. The profile cascade then removes all memberships.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id)
  REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- Memberships and invitations intentionally restrict direct role deletion.
-- Remove those tenant-owned rows first so a full tenant deletion stays atomic
-- and cannot depend on PostgreSQL cascade-trigger ordering.
CREATE OR REPLACE FUNCTION public.delete_platform_tenant(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_tenant_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.tenants
    WHERE id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant not found.' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.team_invitations
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.tenant_memberships
  WHERE tenant_id = p_tenant_id;

  DELETE FROM public.tenants
  WHERE id = p_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_platform_tenant(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_platform_tenant(UUID)
  TO service_role;

COMMIT;
