BEGIN;

-- Hosted Belize Bank checkout sessions are deliberately separate from the
-- paid ledger. A subscription is not activated and no paid invoice is created
-- until the gateway status endpoint confirms a fully authorized payment.
CREATE TABLE IF NOT EXISTS public.subscription_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT GEN_RANDOM_UUID(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'BELIZE_BANK'
    CHECK (provider = 'BELIZE_BANK'),
  merchant_order_number TEXT NOT NULL UNIQUE,
  gateway_order_id TEXT,
  form_url TEXT,
  plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'enterprise')),
  paid_staff_seats INTEGER NOT NULL DEFAULT 0 CHECK (paid_staff_seats >= 0),
  base_amount NUMERIC(12,2) NOT NULL CHECK (base_amount >= 0),
  seat_amount NUMERIC(12,2) NOT NULL CHECK (seat_amount >= 0),
  total_amount NUMERIC(12,2) NOT NULL CHECK (total_amount > 0),
  currency TEXT NOT NULL DEFAULT 'BZD' CHECK (currency = 'BZD'),
  status TEXT NOT NULL DEFAULT 'REGISTERING' CHECK (
    status IN (
      'REGISTERING', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'REFUNDED'
    )
  ),
  gateway_status INTEGER,
  last_operation TEXT,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  verified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, request_id),
  CHECK (base_amount + seat_amount = total_amount)
);

CREATE UNIQUE INDEX IF NOT EXISTS subscription_checkout_gateway_order_idx
  ON public.subscription_checkout_sessions (gateway_order_id)
  WHERE gateway_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscription_checkout_tenant_created_idx
  ON public.subscription_checkout_sessions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS subscription_checkout_pending_idx
  ON public.subscription_checkout_sessions (status, updated_at DESC)
  WHERE status IN ('REGISTERING', 'PENDING');

ALTER TABLE public.subscription_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Checkout sessions contain provider references and diagnostic metadata. They
-- are accessed only by authenticated server routes using the service role.
REVOKE ALL ON public.subscription_checkout_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.subscription_checkout_sessions TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
