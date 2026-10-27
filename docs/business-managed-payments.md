# Business-managed customer payments

Customer payments are coordinated between each customer and the business they
are buying from. They never use YuhBusiness's Belize Bank subscription merchant
account and are not written to the platform subscription invoice/payment
ledger.

## Deployment

1. Apply the payment and checkout migrations in timestamp order from
   `202610220001_business_managed_payments_fulfillment.sql` through
   `202610270002_atomic_customer_payment_review.sql` after all earlier
   migrations. Do not skip the compatibility, tracking, checkout, or email
   notification migrations between them.
2. Confirm that the private `payment-receipts` Storage bucket exists. The migration creates it with a 5 MB limit for JPG, PNG, and PDF files.
3. No new environment variables or merchant credentials are required.
4. Deploy the Next.js application after the database migration so the new columns and API routes are available together.

## Business workflow

Business owners, admins, and managers open **Payments & Fulfillment** in the
dashboard. They can enable direct bank transfer, cash on delivery, payment on
pickup, payment at appointment, or an HTTPS link to their own approved payment
provider. Methods can be scoped to Appointments, Ordering, and Retail.

Bank-transfer receipts remain private. Uploading a receipt changes payment state
only to **Awaiting verification**. An authorized business user must compare the
submission with the business's own bank records before selecting **Verify funds
received**. Verification actions are immutable audit events and do not change
fulfillment status.

Customers enter the order reference delivered by email and receive a six-digit
verification code. A random, order-scoped tracking token is issued for that
challenge and only its SHA-256 hash is stored. After verification, the session
authorizes order details and receipt submission for that order and matching
checkout email for 24 hours.

## Retail reservation workflow

For retail bank transfers, the inventory deduction and order creation happen in
one locked database transaction. If the last unit is reserved, other storefront
customers see **Awaiting Purchase** instead of an enabled cart action.

When the customer opens **Track Order**, they receive a six-digit, one-time
email code. Its protected hash is stored in the tracking session, and bank
details and receipt upload remain hidden until the code is verified. The owner
controls reservation and payment windows under **Payments & Fulfillment**.

Expired or repeatedly failed verification releases the inventory by cancelling
the pending order. A receipt submitted before the deadline freezes expiration
while the business reviews it. Only business verification of funds converts the
reservation to a completed purchase; it does not complete fulfillment.

## External responsibility

YuhBusiness does not store card details or tenant gateway credentials, confirm
bank settlement, issue tenant refunds, arrange delivery, or resolve payment
disputes. External payment links must use HTTPS, and completing an external flow
does not automatically mark a transaction paid.
