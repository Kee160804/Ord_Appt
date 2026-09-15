BEGIN;

-- ============================================================================
-- YuhBusiness team access, invitations, role management and permission RLS
-- ----------------------------------------------------------------------------
-- This migration upgrades the original fixed MANAGER/STAFF model to the
-- tenant-configurable role model already supported by public.roles.
--
-- Business flow:
--   Owner -> creates role -> chooses permissions -> invites email to role
--   -> invitee signs in -> accepts invitation -> membership receives role_id
--
-- Important:
--   * SUPER_ADMIN remains platform-only.
--   * OWNER is a protected tenant system role.
--   * Custom role permissions are enforced by RLS.
--   * Team seats remain enforced regardless of role name.
-- ============================================================================

-- ============================================================================
-- Plan seat helpers
-- ============================================================================

CREATE OR REPLACE FUNCTION public.team_plan_included_staff(p_plan TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE LOWER(COALESCE(p_plan, 'starter'))
    WHEN 'pro' THEN 1
    WHEN 'enterprise' THEN 2
    ELSE 0
  END;
$$;

CREATE OR REPLACE FUNCTION public.team_plan_max_staff(p_plan TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE LOWER(COALESCE(p_plan, 'starter'))
    WHEN 'pro' THEN 4
    WHEN 'enterprise' THEN 10
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.team_plan_included_staff(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.team_plan_max_staff(TEXT) FROM PUBLIC;

-- ============================================================================
-- Backfill sensible system roles for existing tenants.
-- ----------------------------------------------------------------------------
-- OWNER remains full access.
-- MANAGER / STAFF remain available as defaults, but owners may create
-- additional custom roles.
-- ============================================================================

INSERT INTO public.roles (
  tenant_id,
  name,
  description,
  permissions,
  is_system_role
)
SELECT
  tenant.id,
  role_template.name,
  role_template.description,
  role_template.permissions,
  TRUE
FROM public.tenants AS tenant
CROSS JOIN (
  VALUES
    (
      'MANAGER',
      'Business manager with daily operations access',
      '[
        "view_dashboard",
        "edit_storefront",
        "view_analytics",
        "manage_orders",
        "manage_appointments",
        "manage_customers",
        "view_reports"
      ]'::JSONB
    ),
    (
      'STAFF',
      'Staff member with operational access',
      '[
        "view_dashboard",
        "manage_orders",
        "manage_appointments",
        "view_reports"
      ]'::JSONB
    )
) AS role_template(name, description, permissions)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.roles existing_role
  WHERE existing_role.tenant_id = tenant.id
    AND UPPER(existing_role.name) = role_template.name
);

-- Ensure every existing OWNER has full permissions.
UPDATE public.roles
SET
  permissions = '["*"]'::JSONB,
  is_system_role = TRUE,
  updated_at = NOW()
WHERE UPPER(name) = 'OWNER';

-- ============================================================================
-- Seat entitlements
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_seat_entitlements (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  paid_staff_seats INTEGER NOT NULL DEFAULT 0
    CHECK (paid_staff_seats BETWEEN 0 AND 8),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.tenant_seat_entitlements (tenant_id)
SELECT id
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- Team invitations
-- ----------------------------------------------------------------------------
-- FIX:
-- The old schema stored role_name and only accepted MANAGER/STAFF.
-- The corrected model stores role_id so owners can invite users into ANY
-- tenant role that they control.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,

  -- New canonical assignment target.
  role_id UUID REFERENCES public.roles(id) ON DELETE RESTRICT,

  -- Legacy compatibility only. New code should use role_id.
  role_name TEXT,

  token_hash TEXT NOT NULL UNIQUE,

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),

  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Upgrade an already-existing table.
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS role_id UUID;

ALTER TABLE public.team_invitations
  DROP CONSTRAINT IF EXISTS team_invitations_role_id_fkey;

ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_role_id_fkey
  FOREIGN KEY (role_id)
  REFERENCES public.roles(id)
  ON DELETE RESTRICT;

-- Backfill role_id from the legacy role_name field.
UPDATE public.team_invitations invitation
SET role_id = role.id
FROM public.roles role
WHERE invitation.role_id IS NULL
  AND role.tenant_id = invitation.tenant_id
  AND UPPER(role.name) = UPPER(COALESCE(invitation.role_name, ''));

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_email_idx
  ON public.team_invitations (tenant_id, LOWER(email))
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS team_invitations_tenant_status_idx
  ON public.team_invitations (tenant_id, status, expires_at);

CREATE INDEX IF NOT EXISTS team_invitations_role_idx
  ON public.team_invitations(role_id);

-- ============================================================================
-- Seat-change requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_seat_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  requested_paid_seats INTEGER NOT NULL
    CHECK (requested_paid_seats BETWEEN 0 AND 8),
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_seat_change_requests_one_pending_idx
  ON public.tenant_seat_change_requests (tenant_id)
  WHERE status = 'PENDING';

-- ============================================================================
-- Audit trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_access_events (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  subject_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invitation_id UUID REFERENCES public.team_invitations(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_access_events_tenant_created_idx
  ON public.team_access_events (tenant_id, created_at DESC);

ALTER TABLE public.tenant_seat_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_seat_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_access_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tenant_seat_entitlements FROM anon, authenticated;
REVOKE ALL ON TABLE public.team_invitations FROM anon, authenticated;
REVOKE ALL ON TABLE public.tenant_seat_change_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.team_access_events FROM anon, authenticated;

-- Membership/role writes only happen through secured RPCs.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.tenant_memberships FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.roles FROM authenticated;

-- ============================================================================
-- Canonical permission catalog validation
-- ----------------------------------------------------------------------------
-- Custom role permissions are strings stored in roles.permissions.
-- We intentionally do not hard-code every future permission in SQL.
-- RLS references the concrete permissions it needs.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.role_belongs_to_tenant(
  p_tenant_id UUID,
  p_role_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles r
    WHERE r.id = p_role_id
      AND r.tenant_id = p_tenant_id
  );
$$;

REVOKE ALL ON FUNCTION public.role_belongs_to_tenant(UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.role_belongs_to_tenant(UUID, UUID)
  TO authenticated, service_role;

-- ============================================================================
-- Seat capacity
-- ----------------------------------------------------------------------------
-- OWNER does not consume a staff seat.
-- Every other active membership does.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tenant_authorized_staff_capacity(
  p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT LEAST(
    public.team_plan_max_staff(tenant.plan),
    public.team_plan_included_staff(tenant.plan)
      + COALESCE(entitlement.paid_staff_seats, 0)
  )
  FROM public.tenants tenant
  LEFT JOIN public.tenant_seat_entitlements entitlement
    ON entitlement.tenant_id = tenant.id
  WHERE tenant.id = p_tenant_id;
$$;

REVOKE ALL ON FUNCTION public.tenant_authorized_staff_capacity(UUID)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.enforce_tenant_staff_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role_name TEXT;
  v_capacity INTEGER;
  v_active_staff INTEGER;
BEGIN
  IF NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT UPPER(role.name)
  INTO v_role_name
  FROM public.roles role
  WHERE role.id = NEW.role_id
    AND role.tenant_id = NEW.tenant_id;

  IF v_role_name IS NULL THEN
    RAISE EXCEPTION 'The selected role does not belong to this business.'
      USING ERRCODE = '23503';
  END IF;

  -- OWNER is excluded from the staff-seat limit.
  IF v_role_name = 'OWNER' THEN
    RETURN NEW;
  END IF;

  PERFORM PG_ADVISORY_XACT_LOCK(
    HASHTEXT('team-seats:' || NEW.tenant_id::TEXT)
  );

  v_capacity :=
    COALESCE(public.tenant_authorized_staff_capacity(NEW.tenant_id), 0);

  SELECT COUNT(*)::INTEGER
  INTO v_active_staff
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.tenant_id = NEW.tenant_id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER'
    AND (
      TG_OP = 'INSERT'
      OR membership.id <> NEW.id
    );

  IF v_active_staff >= v_capacity THEN
    RAISE EXCEPTION
      'This business has reached its authorized staff limit. Add a paid seat or change plans first.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_tenant_staff_seat_limit() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_tenant_memberships_staff_seat_limit
  ON public.tenant_memberships;

CREATE TRIGGER trg_tenant_memberships_staff_seat_limit
BEFORE INSERT OR UPDATE OF role_id, is_active
ON public.tenant_memberships
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tenant_staff_seat_limit();

-- ============================================================================
-- Prevent staff-only accounts from creating businesses
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_staff_only_business_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR COALESCE(auth.role() = 'service_role', FALSE)
     OR public.is_super_admin()
  THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_memberships membership
    WHERE membership.profile_id = auth.uid()
      AND membership.is_active = TRUE
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_memberships membership
    JOIN public.roles role ON role.id = membership.role_id
    WHERE membership.profile_id = auth.uid()
      AND membership.is_active = TRUE
      AND UPPER(role.name) = 'OWNER'
  )
  THEN
    RAISE EXCEPTION
      'Team-member-only accounts cannot create businesses.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_staff_only_business_creation()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_staff_only_business_creation
  ON public.tenants;

CREATE TRIGGER trg_guard_staff_only_business_creation
BEFORE INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.guard_staff_only_business_creation();

-- ============================================================================
-- Guard plan downgrade against active team count
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_tenant_plan_staff_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_capacity INTEGER;
  v_active INTEGER;
  v_paid INTEGER;
BEGIN
  IF NEW.plan IS NOT DISTINCT FROM OLD.plan THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(paid_staff_seats, 0)
  INTO v_paid
  FROM public.tenant_seat_entitlements
  WHERE tenant_id = NEW.id;

  IF COALESCE(v_paid, 0) >
     (
       public.team_plan_max_staff(NEW.plan)
       - public.team_plan_included_staff(NEW.plan)
     )
  THEN
    RAISE EXCEPTION
      'Reduce paid staff seats before changing this business plan.'
      USING ERRCODE = 'P0001';
  END IF;

  v_capacity := LEAST(
    public.team_plan_max_staff(NEW.plan),
    public.team_plan_included_staff(NEW.plan)
      + COALESCE(v_paid, 0)
  );

  SELECT COUNT(*)::INTEGER
  INTO v_active
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.tenant_id = NEW.id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER';

  IF v_active > v_capacity THEN
    RAISE EXCEPTION
      'Deactivate staff or authorize enough seats before changing this business plan.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_tenant_plan_staff_capacity()
  FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_guard_tenant_plan_staff_capacity
  ON public.tenants;

CREATE TRIGGER trg_guard_tenant_plan_staff_capacity
BEFORE UPDATE OF plan ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.guard_tenant_plan_staff_capacity();

-- ============================================================================
-- ROLE MANAGEMENT RPCs
-- ----------------------------------------------------------------------------
-- Owners (or a role explicitly granted manage_team) may create/update/delete
-- custom tenant roles.
-- System roles cannot be renamed/deleted through these RPCs.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_tenant_role(
  p_tenant_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT '',
  p_permissions JSONB DEFAULT '[]'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_name TEXT := UPPER(BTRIM(COALESCE(p_name, '')));
  v_role_id UUID;
BEGIN
  IF NOT public.user_can_manage_team(p_tenant_id) THEN
    RAISE EXCEPTION 'You do not have permission to manage roles.'
      USING ERRCODE = '42501';
  END IF;

  IF LENGTH(v_name) < 2 THEN
    RAISE EXCEPTION 'Enter a valid role name.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(COALESCE(p_permissions, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'Role permissions must be a JSON array.'
      USING ERRCODE = '22023';
  END IF;

  IF v_name IN ('OWNER', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'That role name is reserved.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.roles (
    tenant_id,
    name,
    description,
    permissions,
    is_system_role
  )
  VALUES (
    p_tenant_id,
    v_name,
    NULLIF(BTRIM(COALESCE(p_description, '')), ''),
    COALESCE(p_permissions, '[]'::JSONB),
    FALSE
  )
  RETURNING id INTO v_role_id;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    details
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'TEAM_ROLE_CREATED',
    JSONB_BUILD_OBJECT(
      'roleId', v_role_id,
      'name', v_name,
      'permissions', COALESCE(p_permissions, '[]'::JSONB)
    )
  );

  RETURN v_role_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tenant_role(
  p_tenant_id UUID,
  p_role_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT '',
  p_permissions JSONB DEFAULT '[]'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_name TEXT := UPPER(BTRIM(COALESCE(p_name, '')));
  v_system BOOLEAN;
BEGIN
  IF NOT public.user_can_manage_team(p_tenant_id) THEN
    RAISE EXCEPTION 'You do not have permission to manage roles.'
      USING ERRCODE = '42501';
  END IF;

  SELECT is_system_role
  INTO v_system
  FROM public.roles
  WHERE id = p_role_id
    AND tenant_id = p_tenant_id;

  IF v_system IS NULL THEN
    RAISE EXCEPTION 'Role not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_system THEN
    RAISE EXCEPTION 'System roles cannot be edited here.'
      USING ERRCODE = '42501';
  END IF;

  IF LENGTH(v_name) < 2 OR v_name IN ('OWNER', 'SUPER_ADMIN') THEN
    RAISE EXCEPTION 'Enter a valid non-reserved role name.'
      USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(COALESCE(p_permissions, '[]'::JSONB)) <> 'array' THEN
    RAISE EXCEPTION 'Role permissions must be a JSON array.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.roles
  SET
    name = v_name,
    description = NULLIF(BTRIM(COALESCE(p_description, '')), ''),
    permissions = COALESCE(p_permissions, '[]'::JSONB),
    updated_at = NOW()
  WHERE id = p_role_id
    AND tenant_id = p_tenant_id;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    details
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'TEAM_ROLE_UPDATED',
    JSONB_BUILD_OBJECT(
      'roleId', p_role_id,
      'name', v_name,
      'permissions', COALESCE(p_permissions, '[]'::JSONB)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tenant_role(
  p_tenant_id UUID,
  p_role_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_system BOOLEAN;
  v_name TEXT;
BEGIN
  IF NOT public.user_can_manage_team(p_tenant_id) THEN
    RAISE EXCEPTION 'You do not have permission to manage roles.'
      USING ERRCODE = '42501';
  END IF;

  SELECT is_system_role, name
  INTO v_system, v_name
  FROM public.roles
  WHERE id = p_role_id
    AND tenant_id = p_tenant_id;

  IF v_system IS NULL THEN
    RAISE EXCEPTION 'Role not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_system THEN
    RAISE EXCEPTION 'System roles cannot be deleted.'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.tenant_memberships
    WHERE tenant_id = p_tenant_id
      AND role_id = p_role_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.team_invitations
    WHERE tenant_id = p_tenant_id
      AND role_id = p_role_id
      AND status = 'PENDING'
  )
  THEN
    RAISE EXCEPTION
      'Reassign members and revoke pending invitations before deleting this role.'
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.roles
  WHERE id = p_role_id
    AND tenant_id = p_tenant_id;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    details
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'TEAM_ROLE_DELETED',
    JSONB_BUILD_OBJECT(
      'roleId', p_role_id,
      'name', v_name
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_tenant_role(UUID, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_tenant_role(UUID, UUID, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_tenant_role(UUID, UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_tenant_role(UUID, TEXT, TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tenant_role(UUID, UUID, TEXT, TEXT, JSONB)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_tenant_role(UUID, UUID)
  TO authenticated;

-- ============================================================================
-- Team summary
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenant_team_summary(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_plan TEXT;
  v_included INTEGER;
  v_max INTEGER;
  v_paid INTEGER;
  v_capacity INTEGER;
  v_active_staff INTEGER;
  v_result JSONB;
BEGIN
  IF NOT public.user_can_manage_team(p_tenant_id) THEN
    RAISE EXCEPTION 'You do not have permission to manage Team & Access.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.team_invitations
  SET status = 'EXPIRED'
  WHERE tenant_id = p_tenant_id
    AND status = 'PENDING'
    AND expires_at <= NOW();

  SELECT CASE LOWER(COALESCE(tenant.plan::TEXT, 'starter'))
    WHEN 'pro' THEN 'pro'
    WHEN 'enterprise' THEN 'enterprise'
    ELSE 'starter'
  END
  INTO v_plan
  FROM public.tenants tenant
  WHERE tenant.id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.tenant_seat_entitlements (tenant_id)
  VALUES (p_tenant_id)
  ON CONFLICT (tenant_id) DO NOTHING;

  SELECT paid_staff_seats
  INTO v_paid
  FROM public.tenant_seat_entitlements
  WHERE tenant_id = p_tenant_id;

  v_included := public.team_plan_included_staff(v_plan);
  v_max := public.team_plan_max_staff(v_plan);
  v_capacity := LEAST(v_max, v_included + COALESCE(v_paid, 0));

  SELECT COUNT(*)::INTEGER
  INTO v_active_staff
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER';

  SELECT JSONB_BUILD_OBJECT(
    'tenantId', p_tenant_id,
    'plan', v_plan,
    'includedStaff', v_included,
    'maxStaff', v_max,
    'paidStaffSeats', COALESCE(v_paid, 0),
    'authorizedStaff', v_capacity,
    'activeStaff', v_active_staff,
    'additionalSeatPrice', 2,
    'monthlySeatCharge', COALESCE(v_paid, 0) * 2,

    'roles', COALESCE((
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', role.id,
          'name', role.name,
          'description', role.description,
          'permissions', role.permissions,
          'isSystemRole', role.is_system_role,
          'createdAt', role.created_at
        )
        ORDER BY
          CASE WHEN UPPER(role.name) = 'OWNER' THEN 0 ELSE 1 END,
          role.name
      )
      FROM public.roles role
      WHERE role.tenant_id = p_tenant_id
    ), '[]'::JSONB),

    'members', COALESCE((
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'membershipId', membership.id,
          'profileId', profile.id,
          'name',
            COALESCE(
              NULLIF(BTRIM(profile.full_name), ''),
              SPLIT_PART(profile.email, '@', 1)
            ),
          'email', profile.email,
          'roleId', role.id,
          'role', LOWER(role.name),
          'permissions', role.permissions,
          'isActive', membership.is_active,
          'joinedAt', membership.joined_at
        )
        ORDER BY
          CASE WHEN UPPER(role.name) = 'OWNER' THEN 0 ELSE 1 END,
          membership.joined_at
      )
      FROM public.tenant_memberships membership
      JOIN public.roles role ON role.id = membership.role_id
      JOIN public.profiles profile ON profile.id = membership.profile_id
      WHERE membership.tenant_id = p_tenant_id
    ), '[]'::JSONB),

    'invitations', COALESCE((
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', invitation.id,
          'email', invitation.email,
          'roleId', role.id,
          'role', LOWER(role.name),
          'status', LOWER(invitation.status),
          'expiresAt', invitation.expires_at,
          'createdAt', invitation.created_at
        )
        ORDER BY invitation.created_at DESC
      )
      FROM public.team_invitations invitation
      LEFT JOIN public.roles role ON role.id = invitation.role_id
      WHERE invitation.tenant_id = p_tenant_id
        AND invitation.status = 'PENDING'
    ), '[]'::JSONB),

    'pendingSeatRequest', (
      SELECT JSONB_BUILD_OBJECT(
        'id', request.id,
        'requestedPaidSeats', request.requested_paid_seats,
        'status', LOWER(request.status),
        'createdAt', request.created_at
      )
      FROM public.tenant_seat_change_requests request
      WHERE request.tenant_id = p_tenant_id
        AND request.status = 'PENDING'
      ORDER BY request.created_at DESC
      LIMIT 1
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_team_summary(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_team_summary(UUID)
  TO authenticated;

-- ============================================================================
-- Create team invitation
-- ----------------------------------------------------------------------------
-- Uses role_id instead of fixed MANAGER/STAFF names.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_team_invitation(
  p_tenant_id UUID,
  p_email TEXT,
  p_role_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_email TEXT := LOWER(BTRIM(COALESCE(p_email, '')));
  v_role public.roles;
  v_token TEXT :=
    REPLACE(gen_random_uuid()::TEXT, '-', '')
    || REPLACE(gen_random_uuid()::TEXT, '-', '');
  v_invitation public.team_invitations;
  v_capacity INTEGER;
  v_active INTEGER;
  v_pending INTEGER;
BEGIN
  IF NOT public.user_can_manage_team(p_tenant_id) THEN
    RAISE EXCEPTION 'You do not have permission to invite team members.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.tenant_subscription_allows_access(p_tenant_id) THEN
    RAISE EXCEPTION 'This business subscription is inactive.'
      USING ERRCODE = '42501';
  END IF;

  IF LENGTH(v_email) < 5 OR POSITION('@' IN v_email) < 2 THEN
    RAISE EXCEPTION 'Enter a valid staff email address.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_role
  FROM public.roles
  WHERE id = p_role_id
    AND tenant_id = p_tenant_id;

  IF v_role.id IS NULL THEN
    RAISE EXCEPTION 'Selected role was not found for this business.'
      USING ERRCODE = 'P0002';
  END IF;

  IF UPPER(v_role.name) = 'OWNER' THEN
    RAISE EXCEPTION 'Ownership cannot be granted through a normal invitation.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM PG_ADVISORY_XACT_LOCK(
    HASHTEXT('team-seats:' || p_tenant_id::TEXT)
  );

  v_capacity :=
    COALESCE(public.tenant_authorized_staff_capacity(p_tenant_id), 0);

  IF EXISTS (
    SELECT 1
    FROM public.tenant_memberships membership
    JOIN public.profiles profile ON profile.id = membership.profile_id
    WHERE membership.tenant_id = p_tenant_id
      AND membership.is_active = TRUE
      AND LOWER(profile.email) = v_email
  )
  THEN
    RAISE EXCEPTION 'This email already has access to the business.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.team_invitations
  SET
    status = CASE
      WHEN expires_at <= NOW() THEN 'EXPIRED'
      ELSE 'REVOKED'
    END,
    revoked_at = CASE
      WHEN expires_at > NOW() THEN NOW()
      ELSE revoked_at
    END
  WHERE tenant_id = p_tenant_id
    AND LOWER(email) = v_email
    AND status = 'PENDING';

  SELECT COUNT(*)::INTEGER
  INTO v_active
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER';

  SELECT COUNT(*)::INTEGER
  INTO v_pending
  FROM public.team_invitations invitation
  WHERE invitation.tenant_id = p_tenant_id
    AND invitation.status = 'PENDING'
    AND invitation.expires_at > NOW();

  IF v_active + v_pending >= v_capacity THEN
    RAISE EXCEPTION
      'No authorized staff seat is available. Request a paid seat or change plans first.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.team_invitations (
    tenant_id,
    email,
    role_id,
    role_name,
    token_hash,
    invited_by
  )
  VALUES (
    p_tenant_id,
    v_email,
    v_role.id,
    UPPER(v_role.name),
    ENCODE(SHA256(CONVERT_TO(v_token, 'UTF8')), 'hex'),
    auth.uid()
  )
  RETURNING *
  INTO v_invitation;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    invitation_id,
    details
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'TEAM_INVITATION_CREATED',
    v_invitation.id,
    JSONB_BUILD_OBJECT(
      'email', v_email,
      'roleId', v_role.id,
      'role', v_role.name,
      'expiresAt', v_invitation.expires_at
    )
  );

  RETURN JSONB_BUILD_OBJECT(
    'id', v_invitation.id,
    'token', v_token,
    'email', v_email,
    'roleId', v_role.id,
    'role', LOWER(v_role.name),
    'expiresAt', v_invitation.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_invitation(UUID, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_team_invitation(UUID, TEXT, UUID)
  TO authenticated;

-- ============================================================================
-- Accept invitation
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_team_invitation(
  p_token TEXT,
  p_full_name TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_auth_email TEXT;
  v_invitation public.team_invitations;
  v_role public.roles;
  v_capacity INTEGER;
  v_active INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in with the invited email before accepting.'
      USING ERRCODE = '28000';
  END IF;

  SELECT LOWER(email)
  INTO v_auth_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT *
  INTO v_invitation
  FROM public.team_invitations invitation
  WHERE invitation.token_hash = ENCODE(
    SHA256(CONVERT_TO(COALESCE(p_token, ''), 'UTF8')),
    'hex'
  )
  FOR UPDATE;

  IF v_invitation.id IS NULL
     OR v_invitation.status <> 'PENDING'
  THEN
    RAISE EXCEPTION
      'This invitation is invalid or has already been used.'
      USING ERRCODE = '22023';
  END IF;

  IF v_invitation.expires_at <= NOW() THEN
    UPDATE public.team_invitations
    SET status = 'EXPIRED'
    WHERE id = v_invitation.id;

    RAISE EXCEPTION
      'This invitation has expired. Ask the owner for a new one.'
      USING ERRCODE = '22023';
  END IF;

  IF v_auth_email IS NULL
     OR v_auth_email <> LOWER(v_invitation.email)
  THEN
    RAISE EXCEPTION
      'Sign in using the email address that received this invitation.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.tenant_subscription_allows_access(
    v_invitation.tenant_id
  )
  THEN
    RAISE EXCEPTION 'This business subscription is inactive.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_role
  FROM public.roles
  WHERE id = v_invitation.role_id
    AND tenant_id = v_invitation.tenant_id;

  IF v_role.id IS NULL THEN
    RAISE EXCEPTION
      'The role assigned to this invitation no longer exists.'
      USING ERRCODE = 'P0002';
  END IF;

  IF UPPER(v_role.name) = 'OWNER' THEN
    RAISE EXCEPTION
      'Ownership cannot be granted through a team invitation.'
      USING ERRCODE = '42501';
  END IF;

  PERFORM PG_ADVISORY_XACT_LOCK(
    HASHTEXT('team-seats:' || v_invitation.tenant_id::TEXT)
  );

  v_capacity :=
    COALESCE(
      public.tenant_authorized_staff_capacity(v_invitation.tenant_id),
      0
    );

  SELECT COUNT(*)::INTEGER
  INTO v_active
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.tenant_id = v_invitation.tenant_id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER'
    AND membership.profile_id <> v_user_id;

  IF v_active >= v_capacity THEN
    RAISE EXCEPTION
      'This business no longer has an available staff seat.'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user_id
      AND is_active = FALSE
  )
  THEN
    RAISE EXCEPTION 'This account has been deactivated.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    is_active
  )
  VALUES (
    v_user_id,
    COALESCE(
      NULLIF(BTRIM(p_full_name), ''),
      SPLIT_PART(v_auth_email, '@', 1)
    ),
    v_auth_email,
    TRUE
  )
  ON CONFLICT (id)
  DO UPDATE SET
    full_name = CASE
      WHEN NULLIF(BTRIM(p_full_name), '') IS NOT NULL
        THEN BTRIM(p_full_name)
      ELSE public.profiles.full_name
    END,
    email = EXCLUDED.email,
    updated_at = NOW();

  INSERT INTO public.tenant_memberships (
    tenant_id,
    profile_id,
    role_id,
    is_active
  )
  VALUES (
    v_invitation.tenant_id,
    v_user_id,
    v_role.id,
    TRUE
  )
  ON CONFLICT ON CONSTRAINT tenant_memberships_tenant_id_profile_id_key
  DO UPDATE SET
    role_id = EXCLUDED.role_id,
    is_active = TRUE,
    updated_at = NOW();

  UPDATE public.team_invitations
  SET
    status = 'ACCEPTED',
    accepted_by = v_user_id,
    accepted_at = NOW()
  WHERE id = v_invitation.id;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    subject_profile_id,
    invitation_id,
    details
  )
  VALUES (
    v_invitation.tenant_id,
    v_user_id,
    'TEAM_INVITATION_ACCEPTED',
    v_user_id,
    v_invitation.id,
    JSONB_BUILD_OBJECT(
      'roleId', v_role.id,
      'role', v_role.name
    )
  );

  RETURN v_invitation.tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invitation(TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invitation(TEXT, TEXT)
  TO authenticated;

-- ============================================================================
-- Update member role using role_id
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_team_member_role(
  p_tenant_id UUID,
  p_membership_id UUID,
  p_role_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_role public.roles;
  v_subject UUID;
BEGIN
  IF NOT public.user_can_manage_team(p_tenant_id) THEN
    RAISE EXCEPTION 'You do not have permission to change team roles.'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.profile_id
  INTO v_subject
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.id = p_membership_id
    AND membership.tenant_id = p_tenant_id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER';

  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'Team member not found.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT *
  INTO v_role
  FROM public.roles
  WHERE id = p_role_id
    AND tenant_id = p_tenant_id;

  IF v_role.id IS NULL THEN
    RAISE EXCEPTION 'Selected role was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF UPPER(v_role.name) = 'OWNER' THEN
    RAISE EXCEPTION
      'Ownership cannot be assigned through normal team-role editing.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.tenant_memberships
  SET
    role_id = v_role.id,
    updated_at = NOW()
  WHERE id = p_membership_id
    AND tenant_id = p_tenant_id;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    subject_profile_id,
    details
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'TEAM_ROLE_CHANGED',
    v_subject,
    JSONB_BUILD_OBJECT(
      'roleId', v_role.id,
      'role', v_role.name
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_team_member(
  p_tenant_id UUID,
  p_membership_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_subject UUID;
BEGIN
  IF NOT public.user_can_manage_team(p_tenant_id) THEN
    RAISE EXCEPTION 'You do not have permission to remove team access.'
      USING ERRCODE = '42501';
  END IF;

  SELECT membership.profile_id
  INTO v_subject
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.id = p_membership_id
    AND membership.tenant_id = p_tenant_id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER';

  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'Team member not found.'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.tenant_memberships
  SET
    is_active = FALSE,
    updated_at = NOW()
  WHERE id = p_membership_id
    AND tenant_id = p_tenant_id;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    subject_profile_id
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'TEAM_MEMBER_DEACTIVATED',
    v_subject
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_team_invitation(
  p_tenant_id UUID,
  p_invitation_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.user_can_manage_team(p_tenant_id) THEN
    RAISE EXCEPTION 'You do not have permission to revoke invitations.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.team_invitations
  SET
    status = 'REVOKED',
    revoked_at = NOW()
  WHERE id = p_invitation_id
    AND tenant_id = p_tenant_id
    AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending invitation not found.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    invitation_id
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'TEAM_INVITATION_REVOKED',
    p_invitation_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_team_member_role(UUID, UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.deactivate_team_member(UUID, UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_team_invitation(UUID, UUID)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_team_member_role(UUID, UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_team_member(UUID, UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_team_invitation(UUID, UUID)
  TO authenticated;

-- ============================================================================
-- Paid staff-seat requests
-- ============================================================================

CREATE OR REPLACE FUNCTION public.request_tenant_paid_staff_seats(
  p_tenant_id UUID,
  p_requested_paid_seats INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_plan TEXT;
  v_max_paid INTEGER;
  v_current_paid INTEGER;
  v_request_id UUID;
BEGIN
  IF NOT public.current_user_owns_tenant(p_tenant_id) THEN
    RAISE EXCEPTION
      'Only the business owner can request additional seats.'
      USING ERRCODE = '42501';
  END IF;

  SELECT LOWER(COALESCE(plan, 'starter'))
  INTO v_plan
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.tenant_subscription_allows_access(p_tenant_id) THEN
    RAISE EXCEPTION 'This business subscription is inactive.'
      USING ERRCODE = '42501';
  END IF;

  v_max_paid :=
    public.team_plan_max_staff(v_plan)
    - public.team_plan_included_staff(v_plan);

  IF p_requested_paid_seats < 1
     OR p_requested_paid_seats > v_max_paid
  THEN
    RAISE EXCEPTION
      'Choose a paid-seat total allowed by this plan.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(paid_staff_seats, 0)
  INTO v_current_paid
  FROM public.tenant_seat_entitlements
  WHERE tenant_id = p_tenant_id;

  IF p_requested_paid_seats <= COALESCE(v_current_paid, 0) THEN
    RAISE EXCEPTION
      'Request a paid-seat total above the currently approved amount.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tenant_seat_change_requests (
    tenant_id,
    requested_paid_seats,
    requested_by
  )
  VALUES (
    p_tenant_id,
    p_requested_paid_seats,
    auth.uid()
  )
  ON CONFLICT (tenant_id)
    WHERE status = 'PENDING'
  DO UPDATE SET
    requested_paid_seats = EXCLUDED.requested_paid_seats,
    requested_by = EXCLUDED.requested_by,
    created_at = NOW()
  RETURNING id INTO v_request_id;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    details
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'PAID_STAFF_SEATS_REQUESTED',
    JSONB_BUILD_OBJECT(
      'requestedPaidSeats', p_requested_paid_seats,
      'monthlyCharge', p_requested_paid_seats * 2
    )
  );

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tenant_seat_admin_summary(
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION
      'Only a platform administrator can review paid seats.'
      USING ERRCODE = '42501';
  END IF;

  SELECT JSONB_BUILD_OBJECT(
    'paidStaffSeats', COALESCE(entitlement.paid_staff_seats, 0),
    'includedStaff', public.team_plan_included_staff(tenant.plan),
    'maxStaff', public.team_plan_max_staff(tenant.plan),
    'additionalSeatPrice', 2,
    'activeStaff', (
      SELECT COUNT(*)::INTEGER
      FROM public.tenant_memberships membership
      JOIN public.roles role ON role.id = membership.role_id
      WHERE membership.tenant_id = tenant.id
        AND membership.is_active = TRUE
        AND UPPER(role.name) <> 'OWNER'
    ),
    'pendingRequest', (
      SELECT JSONB_BUILD_OBJECT(
        'id', request.id,
        'requestedPaidSeats', request.requested_paid_seats,
        'createdAt', request.created_at
      )
      FROM public.tenant_seat_change_requests request
      WHERE request.tenant_id = tenant.id
        AND request.status = 'PENDING'
      ORDER BY request.created_at DESC
      LIMIT 1
    )
  )
  INTO v_result
  FROM public.tenants tenant
  LEFT JOIN public.tenant_seat_entitlements entitlement
    ON entitlement.tenant_id = tenant.id
  WHERE tenant.id = p_tenant_id;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Business not found.'
      USING ERRCODE = 'P0002';
  END IF;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_tenant_paid_staff_seats(
  p_tenant_id UUID,
  p_paid_staff_seats INTEGER,
  p_request_id UUID DEFAULT NULL,
  p_review_note TEXT DEFAULT ''
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_plan TEXT;
  v_max_paid INTEGER;
  v_included INTEGER;
  v_active INTEGER;
  v_current_paid INTEGER;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION
      'Only a platform administrator can approve paid seats.'
      USING ERRCODE = '42501';
  END IF;

  SELECT LOWER(COALESCE(plan, 'starter'))
  INTO v_plan
  FROM public.tenants
  WHERE id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Business not found.'
      USING ERRCODE = 'P0002';
  END IF;

  v_included := public.team_plan_included_staff(v_plan);
  v_max_paid :=
    public.team_plan_max_staff(v_plan)
    - v_included;

  IF p_paid_staff_seats < 0
     OR p_paid_staff_seats > v_max_paid
  THEN
    RAISE EXCEPTION
      'Paid staff seats exceed this plan allowance.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(paid_staff_seats, 0)
  INTO v_current_paid
  FROM public.tenant_seat_entitlements
  WHERE tenant_id = p_tenant_id;

  IF p_paid_staff_seats > COALESCE(v_current_paid, 0)
     AND NULLIF(BTRIM(COALESCE(p_review_note, '')), '') IS NULL
  THEN
    RAISE EXCEPTION
      'Enter the confirmed payment reference before adding paid seats.'
      USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_active
  FROM public.tenant_memberships membership
  JOIN public.roles role ON role.id = membership.role_id
  WHERE membership.tenant_id = p_tenant_id
    AND membership.is_active = TRUE
    AND UPPER(role.name) <> 'OWNER';

  IF v_active > v_included + p_paid_staff_seats THEN
    RAISE EXCEPTION
      'Deactivate staff before reducing the authorized seat total.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.tenant_seat_entitlements (
    tenant_id,
    paid_staff_seats,
    updated_by,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_paid_staff_seats,
    auth.uid(),
    NOW()
  )
  ON CONFLICT (tenant_id)
  DO UPDATE SET
    paid_staff_seats = EXCLUDED.paid_staff_seats,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();

  IF p_request_id IS NOT NULL THEN
    UPDATE public.tenant_seat_change_requests
    SET
      status = 'APPROVED',
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      review_note = NULLIF(BTRIM(p_review_note), '')
    WHERE id = p_request_id
      AND tenant_id = p_tenant_id
      AND status = 'PENDING'
      AND requested_paid_seats = p_paid_staff_seats;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'The pending seat request no longer matches this approval.'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    details
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'PAID_STAFF_SEATS_SET',
    JSONB_BUILD_OBJECT(
      'paidStaffSeats', p_paid_staff_seats,
      'monthlyCharge', p_paid_staff_seats * 2,
      'note', p_review_note
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_tenant_paid_staff_seat_request(
  p_tenant_id UUID,
  p_request_id UUID,
  p_review_note TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION
      'Only a platform administrator can review paid seats.'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_review_note, '')), '') IS NULL THEN
    RAISE EXCEPTION
      'Enter a reason for rejecting this request.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.tenant_seat_change_requests
  SET
    status = 'REJECTED',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    review_note = BTRIM(p_review_note)
  WHERE id = p_request_id
    AND tenant_id = p_tenant_id
    AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending seat request not found.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.team_access_events (
    tenant_id,
    actor_id,
    action,
    details
  )
  VALUES (
    p_tenant_id,
    auth.uid(),
    'PAID_STAFF_SEATS_REJECTED',
    JSONB_BUILD_OBJECT(
      'requestId', p_request_id,
      'note', p_review_note
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_tenant_paid_staff_seats(UUID, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_tenant_seat_admin_summary(UUID)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_tenant_paid_staff_seats(UUID, INTEGER, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_tenant_paid_staff_seat_request(UUID, UUID, TEXT)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.request_tenant_paid_staff_seats(UUID, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_seat_admin_summary(UUID)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_tenant_paid_staff_seats(UUID, INTEGER, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_tenant_paid_staff_seat_request(UUID, UUID, TEXT)
  TO authenticated;

-- ============================================================================
-- Permission-based RLS enforcement
-- ----------------------------------------------------------------------------
-- Read access remains tenant-membership scoped through the baseline policies.
-- Writes are RESTRICTIVE so broad legacy/permissive policies cannot override
-- these requirements.
-- ============================================================================

DO $$
DECLARE
  v_table TEXT;
BEGIN
  -- Business configuration / catalog administration.
  FOREACH v_table IN ARRAY ARRAY[
    'business_settings',
    'business_modules',
    'business_hours',
    'categories',
    'products',
    'services',
    'staff'
  ]
  LOOP
    IF TO_REGCLASS(FORMAT('public.%I', v_table)) IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = v_table
           AND column_name = 'tenant_id'
       )
    THEN
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS team_admin_insert_required ON public.%I',
        v_table
      );
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS team_admin_update_required ON public.%I',
        v_table
      );
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS team_admin_delete_required ON public.%I',
        v_table
      );

      EXECUTE FORMAT(
        'CREATE POLICY team_admin_insert_required
         ON public.%I AS RESTRICTIVE
         FOR INSERT TO authenticated
         WITH CHECK (
           public.is_super_admin()
           OR public.user_has_permission(tenant_id, ''manage_business'')
           OR public.user_has_permission(tenant_id, ''manage_catalog'')
         )',
        v_table
      );

      EXECUTE FORMAT(
        'CREATE POLICY team_admin_update_required
         ON public.%I AS RESTRICTIVE
         FOR UPDATE TO authenticated
         USING (
           public.is_super_admin()
           OR public.user_has_permission(tenant_id, ''manage_business'')
           OR public.user_has_permission(tenant_id, ''manage_catalog'')
         )
         WITH CHECK (
           public.is_super_admin()
           OR public.user_has_permission(tenant_id, ''manage_business'')
           OR public.user_has_permission(tenant_id, ''manage_catalog'')
         )',
        v_table
      );

      EXECUTE FORMAT(
        'CREATE POLICY team_admin_delete_required
         ON public.%I AS RESTRICTIVE
         FOR DELETE TO authenticated
         USING (
           public.is_super_admin()
           OR public.user_has_permission(tenant_id, ''manage_business'')
           OR public.user_has_permission(tenant_id, ''manage_catalog'')
         )',
        v_table
      );
    END IF;
  END LOOP;

  -- Operational data.
  FOREACH v_table IN ARRAY ARRAY[
    'customers',
    'orders',
    'order_items',
    'appointments',
    'appointment_services'
  ]
  LOOP
    IF TO_REGCLASS(FORMAT('public.%I', v_table)) IS NOT NULL
       AND EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = v_table
           AND column_name = 'tenant_id'
       )
    THEN
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS team_operations_insert_required ON public.%I',
        v_table
      );
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS team_operations_update_required ON public.%I',
        v_table
      );
      EXECUTE FORMAT(
        'DROP POLICY IF EXISTS team_operations_delete_required ON public.%I',
        v_table
      );

      EXECUTE FORMAT(
        'CREATE POLICY team_operations_insert_required
         ON public.%I AS RESTRICTIVE
         FOR INSERT TO authenticated
         WITH CHECK (
           public.is_super_admin()
           OR public.user_has_permission(tenant_id, ''manage_orders'')
           OR public.user_has_permission(tenant_id, ''manage_appointments'')
           OR public.user_has_permission(tenant_id, ''manage_customers'')
         )',
        v_table
      );

      EXECUTE FORMAT(
        'CREATE POLICY team_operations_update_required
         ON public.%I AS RESTRICTIVE
         FOR UPDATE TO authenticated
         USING (
           public.is_super_admin()
           OR public.user_has_permission(tenant_id, ''manage_orders'')
           OR public.user_has_permission(tenant_id, ''manage_appointments'')
           OR public.user_has_permission(tenant_id, ''manage_customers'')
         )
         WITH CHECK (
           public.is_super_admin()
           OR public.user_has_permission(tenant_id, ''manage_orders'')
           OR public.user_has_permission(tenant_id, ''manage_appointments'')
           OR public.user_has_permission(tenant_id, ''manage_customers'')
         )',
        v_table
      );

      EXECUTE FORMAT(
        'CREATE POLICY team_operations_delete_required
         ON public.%I AS RESTRICTIVE
         FOR DELETE TO authenticated
         USING (
           public.is_super_admin()
           OR public.user_has_permission(tenant_id, ''manage_orders'')
           OR public.user_has_permission(tenant_id, ''manage_appointments'')
           OR public.user_has_permission(tenant_id, ''manage_customers'')
         )',
        v_table
      );
    END IF;
  END LOOP;
END;
$$;

-- Business/tenant settings themselves remain owner/platform controlled.
DROP POLICY IF EXISTS tenant_owner_update_required ON public.tenants;

CREATE POLICY tenant_owner_update_required
ON public.tenants
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR public.current_tenant_role(id) = 'OWNER'
)
WITH CHECK (
  public.is_super_admin()
  OR public.current_tenant_role(id) = 'OWNER'
);

-- ============================================================================
-- Optional explicit role-management policies
-- ----------------------------------------------------------------------------
-- Direct writes remain revoked. These policies mainly protect future server-side
-- authenticated usage and make the intended rule clear.
-- ============================================================================

DROP POLICY IF EXISTS roles_team_insert ON public.roles;
DROP POLICY IF EXISTS roles_team_update ON public.roles;
DROP POLICY IF EXISTS roles_team_delete ON public.roles;

CREATE POLICY roles_team_insert
ON public.roles
FOR INSERT TO authenticated
WITH CHECK (
  public.user_can_manage_team(tenant_id)
);

CREATE POLICY roles_team_update
ON public.roles
FOR UPDATE TO authenticated
USING (
  public.user_can_manage_team(tenant_id)
  AND is_system_role = FALSE
)
WITH CHECK (
  public.user_can_manage_team(tenant_id)
  AND is_system_role = FALSE
);

CREATE POLICY roles_team_delete
ON public.roles
FOR DELETE TO authenticated
USING (
  public.user_can_manage_team(tenant_id)
  AND is_system_role = FALSE
);

-- ============================================================================
-- Notify PostgREST that functions/schema changed.
-- ============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;
