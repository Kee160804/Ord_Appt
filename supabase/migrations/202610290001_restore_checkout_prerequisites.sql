BEGIN;

-- Restore only the schema prerequisites used by the current customer checkout.
-- This deliberately does not recreate any legacy order or mock-payment RPCs.
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS ordering_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS ordering_paused BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS order_types TEXT[] NOT NULL
    DEFAULT ARRAY['dine_in', 'pickup', 'delivery']::TEXT[],
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS discount_threshold NUMERIC(12,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS minimum_order NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_areas TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS preparation_minutes INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS ordering_open_time TIME,
  ADD COLUMN IF NOT EXISTS ordering_close_time TIME;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.business_settings'::REGCLASS
      AND conname = 'business_settings_ordering_values_check'
  ) THEN
    ALTER TABLE public.business_settings
      ADD CONSTRAINT business_settings_ordering_values_check CHECK (
        tax_rate BETWEEN 0 AND 100
        AND discount_rate BETWEEN 0 AND 100
        AND discount_threshold >= 0
        AND minimum_order >= 0
        AND delivery_fee >= 0
        AND preparation_minutes BETWEEN 5 AND 1440
        AND CARDINALITY(order_types) > 0
        AND order_types <@
          ARRAY['dine_in', 'pickup', 'delivery']::TEXT[]
      );
  END IF;
END;
$$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS requested_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_area TEXT,
  ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

-- Keep the distributed limiter available to every current public mutation
-- without rerunning the obsolete all-in-one mock-payment migration.
CREATE TABLE IF NOT EXISTS public.public_request_limits (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, action, fingerprint, window_started_at)
);

ALTER TABLE public.public_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_request_limits
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.public_request_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_public_rate_limit(
  p_tenant_id UUID,
  p_action TEXT,
  p_fingerprint TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_count INTEGER;
  v_retry_after INTEGER;
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required.' USING ERRCODE = '42501';
  END IF;

  IF p_limit NOT BETWEEN 1 AND 1000
    OR p_window_seconds NOT BETWEEN 1 AND 86400
    OR LENGTH(p_action) NOT BETWEEN 1 AND 40
    OR LENGTH(p_fingerprint) <> 64
  THEN
    RAISE EXCEPTION 'Invalid rate limit request.' USING ERRCODE = '22023';
  END IF;

  v_window := TO_TIMESTAMP(
    FLOOR(EXTRACT(EPOCH FROM NOW()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.public_request_limits (
    tenant_id,
    action,
    fingerprint,
    window_started_at
  )
  VALUES (
    p_tenant_id,
    LOWER(p_action),
    p_fingerprint,
    v_window
  )
  ON CONFLICT (tenant_id, action, fingerprint, window_started_at)
  DO UPDATE SET
    request_count = public.public_request_limits.request_count + 1,
    updated_at = NOW()
  RETURNING request_count INTO v_count;

  v_retry_after := GREATEST(
    1,
    CEIL(
      EXTRACT(
        EPOCH FROM (
          v_window + MAKE_INTERVAL(secs => p_window_seconds) - NOW()
        )
      )
    )::INTEGER
  );

  IF RANDOM() < 0.02 THEN
    DELETE FROM public.public_request_limits
    WHERE window_started_at < NOW() - INTERVAL '2 days';
  END IF;

  RETURN JSONB_BUILD_OBJECT(
    'allowed',
    v_count <= p_limit,
    'retryAfter',
    v_retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_public_rate_limit(
  UUID,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_public_rate_limit(
  UUID,
  TEXT,
  TEXT,
  INTEGER,
  INTEGER
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
