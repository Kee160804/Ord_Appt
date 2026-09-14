BEGIN;

-- Auth user metadata carries the policy versions through email-confirmation
-- signup flows. This server-owned table preserves an append-only audit record
-- at account creation so later metadata edits cannot replace that history.
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL,
  privacy_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acceptance_method TEXT NOT NULL DEFAULT 'signup_checkbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, terms_version, privacy_version)
);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS legal_acceptances_select_own
  ON public.legal_acceptances;
CREATE POLICY legal_acceptances_select_own
  ON public.legal_acceptances
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.legal_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.legal_acceptances TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_signup_legal_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_terms_version TEXT := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'terms_version'), '');
  v_privacy_version TEXT := NULLIF(BTRIM(NEW.raw_user_meta_data ->> 'privacy_version'), '');
BEGIN
  IF v_terms_version IS NULL OR v_privacy_version IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    accepted_at,
    acceptance_method
  )
  VALUES (
    NEW.id,
    v_terms_version,
    v_privacy_version,
    NOW(),
    'signup_checkbox'
  )
  ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.capture_signup_legal_acceptance()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS capture_signup_legal_acceptance_trigger ON auth.users;
CREATE TRIGGER capture_signup_legal_acceptance_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.capture_signup_legal_acceptance();

COMMIT;

