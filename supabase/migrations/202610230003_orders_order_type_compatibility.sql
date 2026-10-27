BEGIN;

-- Some established databases received the retail checkout functions without
-- the earlier ordering-operations column that those functions insert into.
-- Keep the repair additive and preserve any existing fulfillment selection.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'fulfillment_type'
  ) THEN
    EXECUTE $sql$
      UPDATE public.orders
      SET order_type = CASE
        WHEN LOWER(COALESCE(fulfillment_type, '')) IN ('dine_in', 'pickup', 'delivery')
          THEN LOWER(fulfillment_type)
        ELSE 'pickup'
      END
      WHERE order_type IS NULL
    $sql$;
  ELSE
    UPDATE public.orders SET order_type = 'pickup' WHERE order_type IS NULL;
  END IF;
END;
$$;

ALTER TABLE public.orders
  ALTER COLUMN order_type SET DEFAULT 'pickup',
  ALTER COLUMN order_type SET NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
