BEGIN;

-- Older databases created order_email_deliveries with a restrictive
-- event_type check. Retail reservations queue a one-time-code email using a
-- new event, so extend that existing constraint before the reservation RPC
-- writes to the queue. Without this compatibility step PostgreSQL rolls back
-- the complete order transaction.
ALTER TABLE public.order_email_deliveries
  DROP CONSTRAINT IF EXISTS order_email_deliveries_event_type_check;

ALTER TABLE public.order_email_deliveries
  ADD CONSTRAINT order_email_deliveries_event_type_check
  CHECK (event_type IN (
    'ORDER_RECEIVED',
    'ORDER_ACCEPTED',
    'ORDER_PREPARING',
    'ORDER_READY',
    'ORDER_OUT_FOR_DELIVERY',
    'ORDER_COMPLETED',
    'ORDER_CANCELLED',
    'ORDER_EMAIL_VERIFICATION'
  ));

NOTIFY pgrst, 'reload schema';

COMMIT;
