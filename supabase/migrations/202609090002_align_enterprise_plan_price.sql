BEGIN;

CREATE OR REPLACE FUNCTION public.complete_mock_subscription_checkout(p_tenant_id UUID,p_plan TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_price NUMERIC; v_invoice UUID; v_number TEXT; v_reference TEXT; v_now TIMESTAMPTZ:=NOW();
BEGIN
  IF COALESCE((SELECT auth.role()),'')<>'service_role' THEN RAISE EXCEPTION 'Service role required.' USING ERRCODE='42501'; END IF;
  p_plan:=LOWER(COALESCE(p_plan,''));
  v_price:=CASE p_plan WHEN 'starter' THEN 9 WHEN 'pro' THEN 12 WHEN 'enterprise' THEN 15 ELSE NULL END;
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

COMMIT;
