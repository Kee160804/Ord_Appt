BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS track_inventory BOOLEAN;

-- Preserve the meaning of legacy stock values. Before this column existed,
-- NULL stock meant unlimited inventory and a numeric value meant tracked
-- inventory. Do not turn legacy unlimited products into zero-stock products.
UPDATE public.products
SET track_inventory = (stock IS NOT NULL)
WHERE track_inventory IS NULL;

ALTER TABLE public.products
  ALTER COLUMN track_inventory SET DEFAULT TRUE,
  ALTER COLUMN track_inventory SET NOT NULL;

ALTER TABLE public.products
  ALTER COLUMN stock DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_product_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF COALESCE(NEW.track_inventory, TRUE) THEN
    NEW.stock := GREATEST(COALESCE(NEW.stock, 0), 0);
  ELSE
    NEW.stock := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_product_inventory_trigger ON public.products;
CREATE TRIGGER normalize_product_inventory_trigger
BEFORE INSERT OR UPDATE OF stock, track_inventory ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.normalize_product_inventory();

-- Normalize only products that already had a numeric stock value. Legacy NULL
-- stock remains NULL and therefore continues to mean unlimited inventory.
UPDATE public.products
SET stock = GREATEST(COALESCE(stock, 0), 0)
WHERE track_inventory = TRUE;

NOTIFY pgrst, 'reload schema';

COMMIT;
