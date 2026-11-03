BEGIN;

-- Some upgraded projects never received the order timeline table from the
-- original ordering-operations migration. Restore only the timeline storage
-- used by customer tracking; checkout, inventory, and payment behavior remain
-- unchanged.
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  note TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON public.order_status_history (order_id, created_at);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_status_history_tenant_select
  ON public.order_status_history;
CREATE POLICY order_status_history_tenant_select
  ON public.order_status_history
  FOR SELECT TO authenticated
  USING (public.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS super_admin_all_access
  ON public.order_status_history;
CREATE POLICY super_admin_all_access
  ON public.order_status_history
  FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS tenant_subscription_access_required
  ON public.order_status_history;
CREATE POLICY tenant_subscription_access_required
  ON public.order_status_history AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.tenant_subscription_allows_access(tenant_id))
  WITH CHECK (public.tenant_subscription_allows_access(tenant_id));

REVOKE ALL ON TABLE public.order_status_history
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.order_status_history TO authenticated;
GRANT ALL ON TABLE public.order_status_history TO service_role;

-- Use a repair-specific function so installations that already have the
-- original inventory-aware status trigger are not overwritten.
CREATE OR REPLACE FUNCTION public.record_order_status_history_repair()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.order_status_history (
      tenant_id,
      order_id,
      previous_status,
      new_status,
      changed_by
    )
    VALUES (
      NEW.tenant_id,
      NEW.id,
      CASE WHEN TG_OP = 'UPDATE' THEN UPPER(OLD.status) ELSE NULL END,
      UPPER(NEW.status),
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.orders'::REGCLASS
      AND tgname = 'trg_record_order_status_change'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_record_order_status_change
    AFTER INSERT OR UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.record_order_status_history_repair();
  END IF;
END;
$$;

-- Give existing orders one initial timeline event without duplicating any
-- history already present in projects where the original migration succeeded.
INSERT INTO public.order_status_history (
  tenant_id,
  order_id,
  previous_status,
  new_status,
  created_at
)
SELECT
  order_row.tenant_id,
  order_row.id,
  NULL,
  UPPER(order_row.status),
  order_row.created_at
FROM public.orders AS order_row
WHERE NOT EXISTS (
  SELECT 1
  FROM public.order_status_history AS history_row
  WHERE history_row.order_id = order_row.id
);

NOTIFY pgrst, 'reload schema';

COMMIT;
