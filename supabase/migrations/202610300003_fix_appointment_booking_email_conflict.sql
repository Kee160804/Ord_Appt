BEGIN;

-- The payment-aware appointment RPC returns a column named appointment_id.
-- In PL/pgSQL that output variable made the original
-- ON CONFLICT (appointment_id, event_type) target ambiguous and rolled back an
-- otherwise valid booking. Patch the already-deployed function in place so
-- existing installations receive the repair without replaying an older
-- migration.
DO $migration$
DECLARE
  v_signature REGPROCEDURE :=
    'public.create_public_appointment_with_customer_payment(uuid,uuid,date,time without time zone,text,text,text,text,uuid,text,text)'::REGPROCEDURE;
  v_definition TEXT;
  v_conflict_clause CONSTANT TEXT :=
    'ON CONFLICT (appointment_id, event_type) DO NOTHING';
BEGIN
  SELECT pg_get_functiondef(v_signature) INTO v_definition;

  IF POSITION(v_conflict_clause IN v_definition) = 0 THEN
    -- The function may already contain the corrected constraint target. Keep
    -- this migration idempotent while still failing closed for an unexpected
    -- function definition.
    IF POSITION(
      'ON CONFLICT ON CONSTRAINT appointment_email_event_unique DO NOTHING'
      IN v_definition
    ) > 0 THEN
      RETURN;
    END IF;

    RAISE EXCEPTION
      'Unable to locate the appointment email conflict clause for repair.';
  END IF;

  v_definition := REPLACE(
    v_definition,
    v_conflict_clause,
    'ON CONFLICT ON CONSTRAINT appointment_email_event_unique DO NOTHING'
  );

  EXECUTE v_definition;
END;
$migration$;

COMMIT;
