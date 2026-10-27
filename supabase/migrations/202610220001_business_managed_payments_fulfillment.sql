BEGIN;

-- Customer-to-business payments are deliberately isolated from the platform's
-- subscription invoices and payment_transactions ledger. These records are
-- coordination evidence only; YuhBusiness never receives or settles funds.
CREATE TABLE IF NOT EXISTS public.business_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN (
    'bank_transfer','cash_on_delivery','payment_on_pickup',
    'payment_at_appointment','external_link'
  )),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  modules TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  instructions TEXT,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, method),
  CHECK (modules <@ ARRAY['appointment','ordering','retail']::TEXT[]),
  CHECK (external_url IS NULL OR external_url ~ '^https://')
);

CREATE TABLE IF NOT EXISTS public.business_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Primary account',
  bank_name TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_type TEXT,
  currency TEXT NOT NULL DEFAULT 'BZD',
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (char_length(currency) = 3)
);

CREATE TABLE IF NOT EXISTS public.business_fulfillment_settings (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  pickup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  local_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  nationwide_delivery_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  manual_delivery_quote BOOLEAN NOT NULL DEFAULT FALSE,
  pickup_location TEXT,
  pickup_instructions TEXT,
  delivery_notes TEXT,
  preparation_minutes INTEGER NOT NULL DEFAULT 30 CHECK (preparation_minutes BETWEEN 0 AND 10080),
  whatsapp_number TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS fulfillment_status TEXT NOT NULL DEFAULT 'AWAITING_ACCEPTANCE',
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS tracking_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tracking_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS tracking_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_reservation_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS orders_tracking_token_hash_idx
  ON public.orders(tracking_token_hash) WHERE tracking_token_hash IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS appointments_tracking_token_hash_idx
  ON public.appointments(tracking_token_hash) WHERE tracking_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.customer_payment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  expected_amount NUMERIC(12,2) NOT NULL CHECK (expected_amount >= 0),
  submitted_amount NUMERIC(12,2) NOT NULL CHECK (submitted_amount > 0),
  payment_date DATE NOT NULL,
  transaction_reference TEXT,
  receipt_path TEXT NOT NULL,
  receipt_mime_type TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'AWAITING_VERIFICATION' CHECK (status IN (
    'AWAITING_VERIFICATION','VERIFIED','REJECTED','RESUBMISSION_REQUESTED'
  )),
  rejection_reason TEXT,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((order_id IS NOT NULL)::INTEGER + (appointment_id IS NOT NULL)::INTEGER = 1)
);

CREATE INDEX IF NOT EXISTS customer_payment_submissions_tenant_status_idx
  ON public.customer_payment_submissions(tenant_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS customer_payment_submissions_order_idx
  ON public.customer_payment_submissions(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS customer_payment_submissions_appointment_idx
  ON public.customer_payment_submissions(appointment_id) WHERE appointment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.payment_verification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  submission_id UUID NOT NULL REFERENCES public.customer_payment_submissions(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('SUBMITTED','VERIFIED','REJECTED','RESUBMISSION_REQUESTED')),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payment_verification_events_submission_idx
  ON public.payment_verification_events(submission_id,created_at);

CREATE TABLE IF NOT EXISTS public.transaction_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  sender_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('CUSTOMER','BUSINESS')),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((order_id IS NOT NULL)::INTEGER + (appointment_id IS NOT NULL)::INTEGER = 1)
);

CREATE INDEX IF NOT EXISTS transaction_messages_order_idx
  ON public.transaction_messages(order_id,created_at) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS transaction_messages_appointment_idx
  ON public.transaction_messages(appointment_id,created_at) WHERE appointment_id IS NOT NULL;

ALTER TABLE public.business_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_fulfillment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_verification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_payment_methods_member_read ON public.business_payment_methods;
CREATE POLICY business_payment_methods_member_read ON public.business_payment_methods
  FOR SELECT TO authenticated USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS business_payment_methods_owner_manage ON public.business_payment_methods;
CREATE POLICY business_payment_methods_owner_manage ON public.business_payment_methods
  FOR ALL TO authenticated USING (public.current_tenant_role(tenant_id) IN ('OWNER','ADMIN','MANAGER'))
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('OWNER','ADMIN','MANAGER'));

DROP POLICY IF EXISTS business_bank_accounts_member_read ON public.business_bank_accounts;
CREATE POLICY business_bank_accounts_member_read ON public.business_bank_accounts
  FOR SELECT TO authenticated USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS business_bank_accounts_owner_manage ON public.business_bank_accounts;
CREATE POLICY business_bank_accounts_owner_manage ON public.business_bank_accounts
  FOR ALL TO authenticated USING (public.current_tenant_role(tenant_id) IN ('OWNER','ADMIN','MANAGER'))
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('OWNER','ADMIN','MANAGER'));

DROP POLICY IF EXISTS fulfillment_settings_member_read ON public.business_fulfillment_settings;
CREATE POLICY fulfillment_settings_member_read ON public.business_fulfillment_settings
  FOR SELECT TO authenticated USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS fulfillment_settings_owner_manage ON public.business_fulfillment_settings;
CREATE POLICY fulfillment_settings_owner_manage ON public.business_fulfillment_settings
  FOR ALL TO authenticated USING (public.current_tenant_role(tenant_id) IN ('OWNER','ADMIN','MANAGER'))
  WITH CHECK (public.current_tenant_role(tenant_id) IN ('OWNER','ADMIN','MANAGER'));

DROP POLICY IF EXISTS payment_submissions_member_read ON public.customer_payment_submissions;
CREATE POLICY payment_submissions_member_read ON public.customer_payment_submissions
  FOR SELECT TO authenticated USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS payment_events_member_read ON public.payment_verification_events;
CREATE POLICY payment_events_member_read ON public.payment_verification_events
  FOR SELECT TO authenticated USING (public.user_has_tenant_access(tenant_id));
DROP POLICY IF EXISTS transaction_messages_member_read ON public.transaction_messages;
CREATE POLICY transaction_messages_member_read ON public.transaction_messages
  FOR SELECT TO authenticated USING (public.user_has_tenant_access(tenant_id));

GRANT SELECT,INSERT,UPDATE,DELETE ON public.business_payment_methods, public.business_bank_accounts, public.business_fulfillment_settings TO authenticated;
GRANT SELECT ON public.customer_payment_submissions, public.payment_verification_events, public.transaction_messages TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.customer_payment_submissions, public.payment_verification_events, public.transaction_messages FROM authenticated,anon;
REVOKE ALL ON public.business_payment_methods, public.business_bank_accounts, public.business_fulfillment_settings FROM anon;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('payment-receipts','payment-receipts',FALSE,5242880,ARRAY['image/jpeg','image/png','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public=FALSE,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS payment_receipts_member_read ON storage.objects;
CREATE POLICY payment_receipts_member_read ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id='payment-receipts'
  AND public.user_has_tenant_access((storage.foldername(name))[1]::UUID)
);
NOTIFY pgrst,'reload schema';
COMMIT;
