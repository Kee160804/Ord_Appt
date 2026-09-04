BEGIN;

-- Durable, provider-neutral ledger. MOCK transactions make the end-to-end
-- workflow testable now; a bank adapter can later write the same records.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'UNPAID';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS deposit_paid NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  invoice_id UUID,
  provider TEXT NOT NULL DEFAULT 'MOCK',
  provider_reference TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('ORDER','APPOINTMENT','SUBSCRIPTION')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  refunded_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BZD',
  status TEXT NOT NULL CHECK (status IN ('PENDING','SUCCEEDED','PARTIALLY_REFUNDED','REFUNDED','FAILED')),
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((order_id IS NOT NULL)::INTEGER + (appointment_id IS NOT NULL)::INTEGER <= 1),
  CHECK (refunded_amount <= amount)
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_provider_reference_idx ON public.payment_transactions(provider,provider_reference);
CREATE INDEX IF NOT EXISTS payment_transactions_tenant_created_idx ON public.payment_transactions(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.subscription_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL CHECK (plan IN ('starter','pro','enterprise')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'BZD',
  status TEXT NOT NULL CHECK (status IN ('DRAFT','OPEN','PAID','VOID')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  line_items JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_invoice_id_fkey;
ALTER TABLE public.payment_transactions ADD CONSTRAINT payment_transactions_invoice_id_fkey FOREIGN KEY(invoice_id) REFERENCES public.subscription_invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS subscription_invoices_tenant_created_idx ON public.subscription_invoices(tenant_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.platform_integrations (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_checked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO public.platform_integrations(id,display_name,category,mode,status,configuration)
VALUES ('payments','Bank payment gateway','PAYMENTS','MOCK','SANDBOX_READY',JSONB_BUILD_OBJECT('provider','MOCK','currency','BZD','realMoney',FALSE))
ON CONFLICT(id) DO UPDATE SET mode=EXCLUDED.mode,status=EXCLUDED.status,configuration=EXCLUDED.configuration,updated_at=NOW();

-- Persistent distributed throttling for server-side public routes.
CREATE TABLE IF NOT EXISTS public.public_request_limits (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tenant_id,action,fingerprint,window_started_at)
);
ALTER TABLE public.public_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_request_limits FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.check_public_rate_limit(
  p_tenant_id UUID,p_action TEXT,p_fingerprint TEXT,p_limit INTEGER,p_window_seconds INTEGER
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_window TIMESTAMPTZ; v_count INTEGER;
BEGIN
  IF COALESCE((SELECT auth.role()),'') <> 'service_role' THEN RAISE EXCEPTION 'Service role required.' USING ERRCODE='42501'; END IF;
  IF p_limit NOT BETWEEN 1 AND 1000 OR p_window_seconds NOT BETWEEN 1 AND 86400
     OR LENGTH(p_action) NOT BETWEEN 1 AND 40 OR LENGTH(p_fingerprint) <> 64 THEN
    RAISE EXCEPTION 'Invalid rate limit request.' USING ERRCODE='22023';
  END IF;
  v_window:=TO_TIMESTAMP(FLOOR(EXTRACT(EPOCH FROM NOW())/p_window_seconds)*p_window_seconds);
  INSERT INTO public.public_request_limits(tenant_id,action,fingerprint,window_started_at)
  VALUES(p_tenant_id,LOWER(p_action),p_fingerprint,v_window)
  ON CONFLICT(tenant_id,action,fingerprint,window_started_at) DO UPDATE
    SET request_count=public.public_request_limits.request_count+1,updated_at=NOW()
  RETURNING request_count INTO v_count;
  IF RANDOM()<0.02 THEN DELETE FROM public.public_request_limits WHERE window_started_at<NOW()-INTERVAL '2 days'; END IF;
  RETURN JSONB_BUILD_OBJECT('allowed',v_count<=p_limit,'retryAfter',GREATEST(1,CEIL(EXTRACT(EPOCH FROM (v_window+MAKE_INTERVAL(secs=>p_window_seconds)-NOW())))::INTEGER));
END; $$;
REVOKE ALL ON FUNCTION public.check_public_rate_limit(UUID,TEXT,TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.check_public_rate_limit(UUID,TEXT,TEXT,INTEGER,INTEGER) TO service_role;

-- Full-model checkout: pricing, promotion, inventory, payment, and the order
-- are committed or rolled back together.
CREATE OR REPLACE FUNCTION public.create_public_order_v3(
  p_tenant_id UUID,p_customer_name TEXT,p_customer_email TEXT,p_customer_phone TEXT,
  p_order_type TEXT,p_items JSONB,p_requested_time TIMESTAMPTZ DEFAULT NULL,
  p_delivery_address TEXT DEFAULT NULL,p_delivery_area TEXT DEFAULT NULL,
  p_delivery_instructions TEXT DEFAULT NULL,p_table_number TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,p_promotion_code TEXT DEFAULT NULL,p_payment_method TEXT DEFAULT 'pay_later'
) RETURNS TABLE(order_id UUID,order_number TEXT,total NUMERIC,payment_status TEXT,payment_reference TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_created RECORD; v_total NUMERIC; v_reference TEXT; v_payment TEXT:=LOWER(COALESCE(p_payment_method,'pay_later'));
BEGIN
  IF v_payment NOT IN ('pay_later','mock_card') THEN RAISE EXCEPTION 'Choose a valid payment method.' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_created FROM public.create_public_order_v2(p_tenant_id,p_customer_name,p_customer_email,p_customer_phone,p_order_type,p_items,p_requested_time,p_delivery_address,p_delivery_area,p_delivery_instructions,p_table_number,p_notes);
  v_total:=v_created.total;
  IF NULLIF(BTRIM(COALESCE(p_promotion_code,'')),'') IS NOT NULL THEN
    v_total:=public.apply_public_order_promotion(p_tenant_id,v_created.order_id,p_promotion_code);
  END IF;
  IF v_payment='mock_card' THEN
    v_reference:='MOCK-'||UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT,'-',''),16));
    INSERT INTO public.payment_transactions(tenant_id,order_id,provider_reference,kind,amount,status,idempotency_key,paid_at,metadata)
    VALUES(p_tenant_id,v_created.order_id,v_reference,'ORDER',v_total,'SUCCEEDED','mock-order/'||v_created.order_id,NOW(),JSONB_BUILD_OBJECT('notice','Simulated payment; no real money processed'));
    UPDATE public.orders SET payment_status='PAID' WHERE id=v_created.order_id AND tenant_id=p_tenant_id;
  END IF;
  RETURN QUERY SELECT v_created.order_id::UUID,v_created.order_number::TEXT,v_total,
    CASE WHEN v_payment='mock_card' THEN 'PAID' ELSE 'UNPAID' END::TEXT,v_reference;
END; $$;
REVOKE ALL ON FUNCTION public.create_public_order_v3(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order_v3(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.create_public_appointment_with_payment(
  p_tenant_id UUID,p_service_id UUID,p_appointment_date DATE,p_appointment_time TIME,
  p_customer_name TEXT,p_customer_email TEXT,p_customer_phone TEXT,p_notes TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,p_promotion_code TEXT DEFAULT NULL,p_payment_method TEXT DEFAULT 'pay_later'
) RETURNS TABLE(appointment_id UUID,payment_status TEXT,payment_reference TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id UUID; v_amount NUMERIC; v_reference TEXT; v_payment TEXT:=LOWER(COALESCE(p_payment_method,'pay_later'));
BEGIN
  IF v_payment NOT IN ('pay_later','mock_card') THEN RAISE EXCEPTION 'Choose a valid payment method.' USING ERRCODE='22023'; END IF;
  v_id:=public.create_public_appointment_with_provider(p_tenant_id,p_service_id,p_appointment_date,p_appointment_time,p_customer_name,p_customer_email,p_customer_phone,p_notes,p_staff_id,p_promotion_code);
  IF v_payment='mock_card' THEN
    SELECT CASE WHEN deposit_required>0 THEN deposit_required ELSE total END INTO v_amount FROM public.appointments WHERE id=v_id AND tenant_id=p_tenant_id FOR UPDATE;
    v_reference:='MOCK-'||UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT,'-',''),16));
    INSERT INTO public.payment_transactions(tenant_id,appointment_id,provider_reference,kind,amount,status,idempotency_key,paid_at,metadata)
    VALUES(p_tenant_id,v_id,v_reference,'APPOINTMENT',COALESCE(v_amount,0),'SUCCEEDED','mock-appointment/'||v_id,NOW(),JSONB_BUILD_OBJECT('notice','Simulated payment; no real money processed'));
    UPDATE public.appointments SET payment_status='PAID',deposit_paid=COALESCE(v_amount,0) WHERE id=v_id AND tenant_id=p_tenant_id;
  END IF;
  RETURN QUERY SELECT v_id,CASE WHEN v_payment='mock_card' THEN 'PAID' ELSE 'UNPAID' END::TEXT,v_reference;
END; $$;
REVOKE ALL ON FUNCTION public.create_public_appointment_with_payment(UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_appointment_with_payment(UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_mock_subscription_checkout(p_tenant_id UUID,p_plan TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_price NUMERIC; v_invoice UUID; v_number TEXT; v_reference TEXT; v_now TIMESTAMPTZ:=NOW();
BEGIN
  IF COALESCE((SELECT auth.role()),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required.' USING ERRCODE='42501'; END IF;
  p_plan:=LOWER(COALESCE(p_plan,''));
  v_price:=CASE p_plan WHEN 'starter' THEN 9 WHEN 'pro' THEN 12 WHEN 'enterprise' THEN 16 ELSE NULL END;
  IF v_price IS NULL THEN RAISE EXCEPTION 'Choose a valid plan.' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant_id) THEN RAISE EXCEPTION 'Business not found.' USING ERRCODE='P0002'; END IF;
  v_reference:='MOCK-'||UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT,'-',''),10));
  v_number:='YB-'||TO_CHAR(v_now,'YYYYMM')||'-'||UPPER(LEFT(REPLACE(GEN_RANDOM_UUID()::TEXT,'-',''),10));
  INSERT INTO public.subscription_invoices(tenant_id,invoice_number,plan,amount,status,period_start,period_end,due_at,paid_at,line_items)
  VALUES(p_tenant_id,v_number,p_plan,v_price,'PAID',v_now,v_now+INTERVAL '1 month',v_now,v_now,
    JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT('description',INITCAP(p_plan)||' monthly subscription (mock)','quantity',1,'unitAmount',v_price))) RETURNING id INTO v_invoice;
  INSERT INTO public.payment_transactions(tenant_id,invoice_id,provider_reference,kind,amount,status,idempotency_key,paid_at,metadata)
  VALUES(p_tenant_id,v_invoice,v_reference,'SUBSCRIPTION',v_price,'SUCCEEDED','mock-subscription/'||v_invoice,v_now,
    JSONB_BUILD_OBJECT('plan',p_plan,'notice','Simulated payment; no real money processed'));
  UPDATE public.tenants SET plan=p_plan,subscription_status='active',updated_at=v_now WHERE id=p_tenant_id;
  RETURN JSONB_BUILD_OBJECT('invoiceId',v_invoice,'invoiceNumber',v_number,'amount',v_price,'currency','BZD','paymentReference',v_reference,'plan',p_plan,'status','active');
END; $$;
REVOKE ALL ON FUNCTION public.complete_mock_subscription_checkout(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_mock_subscription_checkout(UUID,TEXT) TO service_role;

-- Public mutations must pass through the throttled Next.js routes. Remove the
-- grants made by older migrations so callers cannot bypass origin, honeypot,
-- payload-size, and distributed rate-limit checks through PostgREST.
REVOKE ALL ON FUNCTION public.create_public_order(UUID,TEXT,TEXT,TEXT,JSONB,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_public_order_v2(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_public_order_with_promotion(UUID,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_public_order_with_email(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_public_appointment(UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.create_public_appointment_with_provider(UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.calculate_promotion_discount(UUID,TEXT,NUMERIC,UUID[],UUID) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_public_order_promotion(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_public_appointment_promotion(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_storefront_contact_message(UUID,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_order_v2(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TIMESTAMPTZ,TEXT,TEXT,TEXT,TEXT,TEXT), public.create_public_order_with_email(UUID,TEXT,TEXT,TEXT,TEXT,JSONB,TEXT,TEXT), public.create_public_appointment_with_provider(UUID,UUID,DATE,TIME,TEXT,TEXT,TEXT,TEXT,UUID,TEXT), public.calculate_promotion_discount(UUID,TEXT,NUMERIC,UUID[],UUID), public.submit_storefront_contact_message(UUID,TEXT,TEXT,TEXT,TEXT) TO service_role;

-- Queue receipts after the transaction has assembled the order items. The
-- deferred insert trigger covers v2/v3; the update trigger preserves the
-- legacy flow that adds the customer email after inserting line items.
CREATE OR REPLACE FUNCTION public.enqueue_order_received_after_email()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_tenant public.tenants%ROWTYPE; v_items JSONB;
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NULLIF(BTRIM(COALESCE(OLD.customer_email,'')),'') IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  IF NULLIF(BTRIM(COALESCE(NEW.customer_email,'')),'') IS NULL OR UPPER(COALESCE(NEW.status,''))<>'PENDING' THEN RETURN NEW; END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id=NEW.tenant_id;
  SELECT COALESCE(JSONB_AGG(JSONB_BUILD_OBJECT('name',item.product_name,'quantity',item.quantity,'unit_price',item.unit_price,'subtotal',item.subtotal) ORDER BY item.created_at),'[]'::JSONB)
    INTO v_items FROM public.order_items item WHERE item.order_id=NEW.id;
  BEGIN
    INSERT INTO public.order_email_deliveries(tenant_id,order_id,event_type,recipient_email,recipient_name,subject,payload)
    VALUES(NEW.tenant_id,NEW.id,'ORDER_RECEIVED',LOWER(NEW.customer_email),COALESCE(NULLIF(BTRIM(NEW.customer_name),''),'Customer'),'We received order '||NEW.order_number,
      JSONB_BUILD_OBJECT('business_name',v_tenant.business_name,'business_email',v_tenant.email,'business_phone',v_tenant.phone,'order_number',NEW.order_number,'total',NEW.total,'items',v_items))
    ON CONFLICT(order_id,event_type) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Order saved but confirmation email enqueue failed: %',SQLERRM; END;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enqueue_order_received_after_email ON public.orders;
DROP TRIGGER IF EXISTS trg_enqueue_order_received_after_insert ON public.orders;
CREATE CONSTRAINT TRIGGER trg_enqueue_order_received_after_insert
  AFTER INSERT ON public.orders DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_received_after_email();
CREATE TRIGGER trg_enqueue_order_received_after_email
  AFTER UPDATE OF customer_email ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_order_received_after_email();

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_transactions_tenant_select ON public.payment_transactions FOR SELECT TO authenticated USING(public.user_has_tenant_access(tenant_id) OR public.is_super_admin());
CREATE POLICY subscription_invoices_tenant_select ON public.subscription_invoices FOR SELECT TO authenticated USING(public.user_has_tenant_access(tenant_id) OR public.is_super_admin());
CREATE POLICY platform_integrations_admin_select ON public.platform_integrations FOR SELECT TO authenticated USING(public.is_super_admin());
GRANT SELECT ON public.payment_transactions,public.subscription_invoices TO authenticated;
GRANT SELECT ON public.platform_integrations TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.payment_transactions,public.subscription_invoices,public.platform_integrations FROM authenticated,anon;

NOTIFY pgrst,'reload schema';
COMMIT;
