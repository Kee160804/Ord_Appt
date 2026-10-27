BEGIN;

-- The retail totals wrapper expects these owner-controlled automatic discount
-- fields. Some established databases have tax_rate but predate these columns.
ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS discount_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS discount_threshold NUMERIC(12,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS discount_rate NUMERIC(5,2) NOT NULL DEFAULT 5;

NOTIFY pgrst, 'reload schema';

COMMIT;
