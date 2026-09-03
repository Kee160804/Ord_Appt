BEGIN;

-- Team capacity functions count non-owner memberships. Keep the public plan
-- promise at ten total Enterprise accounts by allowing nine staff plus owner.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tenants tenant
    JOIN public.tenant_memberships membership ON membership.tenant_id = tenant.id
    JOIN public.roles role ON role.id = membership.role_id
    WHERE LOWER(COALESCE(tenant.plan, 'starter')) = 'enterprise'
      AND membership.is_active = TRUE
      AND UPPER(role.name) IN ('ADMIN', 'MANAGER', 'STAFF')
    GROUP BY tenant.id
    HAVING COUNT(*) > 9
  ) THEN
    RAISE EXCEPTION 'An Enterprise business has more than 9 active staff. Remove excess access before applying the 10-account limit.';
  END IF;
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
    WHEN 'enterprise' THEN 9
    ELSE 0
  END;
$$;

-- Eight paid Enterprise seats belonged to the previous 11-account model.
-- Normalize those entitlements to the new seven-paid-seat maximum.
UPDATE public.tenant_seat_entitlements entitlement
SET paid_staff_seats = 7,
    updated_at = NOW()
FROM public.tenants tenant
WHERE tenant.id = entitlement.tenant_id
  AND LOWER(COALESCE(tenant.plan, 'starter')) = 'enterprise'
  AND entitlement.paid_staff_seats > 7;

UPDATE public.tenant_seat_change_requests request
SET status = 'CANCELLED',
    reviewed_at = NOW(),
    review_note = CONCAT_WS(
      ' ',
      NULLIF(BTRIM(request.review_note), ''),
      'Cancelled because the Enterprise limit is 10 total accounts including the owner (7 paid staff seats maximum).'
    )
FROM public.tenants tenant
WHERE tenant.id = request.tenant_id
  AND LOWER(COALESCE(tenant.plan, 'starter')) = 'enterprise'
  AND request.status = 'PENDING'
  AND request.requested_paid_seats > 7;

COMMENT ON FUNCTION public.team_plan_max_staff(TEXT) IS
  'Maximum non-owner accounts by plan: Beginner 0, Pro 4, Enterprise 9.';

COMMIT;
