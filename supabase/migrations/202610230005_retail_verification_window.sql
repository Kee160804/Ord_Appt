BEGIN;

-- New retail reservations allow customers enough time to receive the email,
-- return to the storefront, enter the code, and unlock receipt upload.
ALTER TABLE public.business_fulfillment_settings
  ALTER COLUMN email_verification_minutes SET DEFAULT 30;

-- Upgrade the original five-minute rollout value. Deliberately preserve any
-- other explicit owner choice within the supported 2..30 minute range.
UPDATE public.business_fulfillment_settings
SET email_verification_minutes = 30,
    updated_at = NOW()
WHERE email_verification_minutes = 5;

COMMIT;
