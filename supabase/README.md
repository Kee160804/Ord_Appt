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
