# Supabase database workflow

The database is the source of truth for production. Keep every SQL change in
`supabase/migrations` and apply migrations in order to development, staging,
and production projects.

The large schema supplied with this project is the baseline evolution script.
Save that exact script as the migration immediately before
`202608240001_app_compatibility.sql` so a new environment can be reproduced
without relying on SQL Editor history.

After connecting the Supabase CLI, generate the canonical TypeScript database
types whenever the schema changes:

```powershell
npx supabase gen types typescript --project-id YOUR_PROJECT_REF --schema public > app/types/database.generated.ts
```

Do not put the service-role key in a `NEXT_PUBLIC_` variable. The browser uses
only the publishable (or legacy anon) key and relies on RLS for authorization.

For inventory tracking, category management, and storefront Sold Out states,
apply `202608260001_product_inventory_management.sql` after the public checkout
migration. Existing zero-stock products remain published but cannot be added to
the cart until restocked; owners may separately pause a listing with its
availability toggle.

For projects that already applied the first owner-onboarding migration, apply
`202608260002_owner_onboarding_idempotency.sql`. It makes signup/login retries
cooperate with foundational `trg_initialize_new_tenant` installations and
prevents duplicate OWNER membership inserts.

## Cross-tenant RLS verification

Seed two test owner accounts in different tenants. Business B must have at
least one product, service, order, customer, and appointment. Also create an
inactive tenant, then provide its ID without exposing any service-role key:

```text
RLS_TEST_A_EMAIL=
RLS_TEST_A_PASSWORD=
RLS_TEST_B_EMAIL=
RLS_TEST_B_PASSWORD=
RLS_TEST_INACTIVE_TENANT_ID=
```

Run `npm run test:rls`. The live test verifies cross-tenant product/customer/
appointment reads, order updates, anonymous active-only reads, inactive-tenant
booking rejection, and cross-tenant service booking rejection.

For a real fresh-account check, register a new account through the application,
confirm its email, set `ONBOARDING_TEST_EMAIL` and `ONBOARDING_TEST_PASSWORD`,
then run `npm run test:onboarding`. It verifies the auth user, profile, tenant,
membership, and OWNER role chain using that user's JWT.

## Appointment confirmation emails

The confirmation-email pipeline consists of:

1. `202608240003_appointment_confirmation_emails.sql`, which creates the email
   outbox and queues one delivery when an appointment first becomes confirmed.
2. `functions/send-appointment-email`, which securely sends the queued email
   through Resend and records the delivery result.
3. A Supabase Database Webhook that invokes the Edge Function for new outbox
   rows.

### 1. Apply the database migration

Run the complete contents of
`migrations/202608240003_appointment_confirmation_emails.sql` in the Supabase
SQL Editor. A successful migration reports `Success. No rows returned`.

### 2. Configure Resend and Edge Function secrets

Create a sending-only API key in Resend and verify the domain used by the
sender address. Generate a separate long random webhook secret. Never put
either secret in a `NEXT_PUBLIC_` environment variable.

In Supabase Dashboard, open **Edge Functions > Secrets** and add:

```text
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=LocalSpace <bookings@your-verified-domain.com>
NOTIFICATION_WEBHOOK_SECRET=a-long-random-value
```

For initial Resend testing, follow the recipient and sender restrictions shown
in the Resend dashboard. A verified domain is required before sending to all
customer addresses.

### 3. Deploy the Edge Function

After authenticating and linking the Supabase CLI, run:

```powershell
npx supabase functions deploy send-appointment-email --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

JWT verification is disabled only because the endpoint is called by the
database webhook. The function requires and verifies the private
`x-webhook-secret` header before processing anything.

### 4. Create the Database Webhook

In Supabase Dashboard, open **Database > Webhooks > Create a new webhook** and
use:

```text
Name: appointment-confirmation-email
Table: public.appointment_email_deliveries
Events: INSERT only
Method: POST
URL: https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-appointment-email
Header: x-webhook-secret = the same NOTIFICATION_WEBHOOK_SECRET value
```

Save and enable the webhook before confirming the test appointment.

### 5. Test and inspect delivery

Create a new pending appointment and confirm it from the owner dashboard. Then
inspect the delivery without exposing secrets:

```sql
SELECT
  appointment_id,
  recipient_email,
  status,
  attempt_count,
  provider_message_id,
  last_error,
  created_at,
  sent_at
FROM public.appointment_email_deliveries
ORDER BY created_at DESC
LIMIT 10;
```

`SENT` means Resend accepted the email. `FAILED` includes a safe provider error
in `last_error`. Each appointment confirmation has one outbox row, and the Edge
Function also sends a Resend idempotency key to prevent duplicate emails.
