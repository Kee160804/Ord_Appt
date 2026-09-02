# YuhBusiness transactional email

YuhBusiness uses Resend as an additional delivery channel. Supabase remains the source of truth, and the existing in-app notification center remains active.

## Architecture

1. Orders, appointments, account/business creation, contact messages, billing changes, and important alerts write durable delivery rows in Supabase.
2. The database transaction never calls Resend. A queue insert is best-effort, so an email outage cannot roll back a valid order, appointment, contact message, or subscription update.
3. `GET /api/email/process` claims jobs atomically with `FOR UPDATE SKIP LOCKED`, reloads the tenant and source record, verifies the recipient and `tenant_id`, and sends through the server-only Resend SDK.
4. Successful provider IDs and failures are recorded. Jobs retry at most three times. Stale processing leases recover after 15 minutes.
5. Resend idempotency keys provide a second layer of duplicate protection.

The worker consumes the existing `order_email_deliveries`, `appointment_email_deliveries`, and `appointment_reminders` records. The new `transactional_email_deliveries` table covers only events that had no existing outbox.

## Files

- `app/lib/email/resend.ts`: server-only Resend transport and recipient validation.
- `app/lib/email/templates.ts`: responsive branded templates for every event.
- `app/lib/email/worker.ts`: claiming, tenant/source validation, delivery, retry state, and safe logging.
- `app/api/email/process/route.ts`: authenticated cron/webhook endpoint.
- `supabase/migrations/202609050001_transactional_email_service.sql`: outbox, contact messages, triggers, checkout email support, and worker RPCs.

## 1. Apply the Supabase migration

Open Supabase Dashboard → SQL Editor, paste the complete contents of `supabase/migrations/202609050001_transactional_email_service.sql`, and run it once. It is additive and idempotent; do not paste individual functions out of order. It also creates the order and appointment email delivery queues when an older project does not already have them, then safely upgrades existing queues.

Confirm the objects exist:

```sql
select to_regclass('public.transactional_email_deliveries') as email_outbox,
       to_regclass('public.storefront_contact_messages') as contact_messages;

select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('claim_email_jobs', 'mark_email_job_result', 'enqueue_due_trial_emails');
```

## 2. Create a Resend API key

1. In Resend, open API Keys and create a sending key.
2. Copy it immediately. Never put it in source code, a screenshot, or a variable beginning with `NEXT_PUBLIC_`.
3. Until a domain is verified, use `YuhBusiness <onboarding@resend.dev>` as the sender. Resend's test domain normally delivers only to the email address that owns the Resend account.

## 3. Configure local variables

Add these to `.env.local` (never commit it):

```dotenv
RESEND_API_KEY=re_your_real_key
RESEND_FROM_EMAIL=YuhBusiness <onboarding@resend.dev>
SUPABASE_SECRET_KEY=sb_secret_your_server_secret
CRON_SECRET=use-a-random-secret-with-at-least-32-characters
EMAIL_WEBHOOK_SECRET=use-a-different-random-secret-with-at-least-32-characters
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` is accepted for a legacy project, but prefer the newer `sb_secret_...` value in `SUPABASE_SECRET_KEY`. Both are server-only and bypass RLS. Restart `npm run dev` after changing variables.

## 4. Configure Vercel

In Vercel → Project → Settings → Environment Variables, add the same variables for Production (and Preview only if previews should send real email):

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SUPABASE_SECRET_KEY`
- `CRON_SECRET`
- `EMAIL_WEBHOOK_SECRET`
- `NEXT_PUBLIC_APP_URL` with the production HTTPS URL

Redeploy after saving. Never create `NEXT_PUBLIC_RESEND_API_KEY` or `NEXT_PUBLIC_SUPABASE_SECRET_KEY`.

## 5. Schedule reminders and retries

The endpoint must run every 1–5 minutes for accurate two-hour reminders. Supabase Cron is recommended because Vercel Hobby permits only once-daily Cron Jobs.

Enable `pg_cron`, `pg_net`, and Vault, then store the endpoint and the same `CRON_SECRET` used by Vercel:

```sql
select vault.create_secret(
  'https://YOUR-PRODUCTION-DOMAIN.vercel.app/api/email/process',
  'yuhbusiness_email_worker_url'
);
select vault.create_secret(
  'PASTE_THE_SAME_CRON_SECRET_USED_IN_VERCEL',
  'yuhbusiness_email_worker_secret'
);
```

Schedule it every two minutes:

```sql
select cron.schedule(
  'yuhbusiness-transactional-email-worker',
  '*/2 * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets
            where name = 'yuhbusiness_email_worker_url' limit 1),
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                     where name = 'yuhbusiness_email_worker_secret' limit 1)
    ),
    timeout_milliseconds := 30000
  ) as request_id;
  $$
);
```

Check recent runs:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details order by start_time desc limit 20;
```

Remove it later with `select cron.unschedule('yuhbusiness-transactional-email-worker');`.

If Vercel is on Pro or Enterprise, Vercel Cron can call the same endpoint. Do not add a frequent `vercel.json` schedule on Hobby because that can make deployment fail.

## 6. Optional near-real-time webhooks

The cron is sufficient. For faster delivery, create Supabase Database Webhooks for INSERT on:

- `transactional_email_deliveries`
- `order_email_deliveries`
- `appointment_email_deliveries`

Use:

```text
POST https://YOUR-PRODUCTION-DOMAIN.vercel.app/api/email/process
Authorization: Bearer YOUR_EMAIL_WEBHOOK_SECRET
Content-Type: application/json
```

The endpoint ignores webhook record details and reloads claimed rows from Supabase, preventing a forged payload from selecting a recipient or tenant.

If old webhooks still target `send-order-email` or `send-appointment-email`, disable them after the central endpoint is live. Queue claiming protects the transition; disabling them guarantees all messages use the centralized templates.

## 7. Configure Supabase Auth email through Resend

Confirmation, password reset, magic-link, and Auth invitation messages originate inside Supabase Auth. Configure Supabase → Authentication → Email/SMTP:

```text
Host: smtp.resend.com
Port: 465
Username: resend
Password: your Resend API key
Sender name: YuhBusiness
Sender email: onboarding@resend.dev (testing only)
```

Keep email confirmation enabled. When the domain is ready, replace the sender with a verified authentication subdomain and brand the Supabase Auth templates.

## 8. Manual tests

For no-domain testing, use the Resend account owner's email as the customer/business email.

### Worker security

An unauthenticated request must return `401`:

```powershell
Invoke-WebRequest http://localhost:3000/api/email/process -SkipHttpErrorCheck
```

### Contact form

1. Open a Pro/Enterprise (or active-trial) storefront and submit Contact using the test email.
2. Confirm it was saved and queued:

```sql
select id, tenant_id, sender_email, subject, created_at
from public.storefront_contact_messages order by created_at desc limit 5;
select id, event_type, status, attempt_count, last_error, provider_message_id
from public.transactional_email_deliveries order by created_at desc limit 10;
```

3. Trigger the local worker:

```powershell
$headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Method Get -Uri "http://localhost:3000/api/email/process?limit=10" -Headers $headers
```

Expect `ok: true` and a positive `sent` count. Confirm the Resend dashboard shows the returned provider message.

### Orders

Place an order using the test email. Checkout writes `orders.customer_email`, queues `ORDER_RECEIVED`, and subsequent dashboard status changes use the existing order-status outbox.

```sql
select event_type, status, attempt_count, provider_message_id, last_error
from public.order_email_deliveries order by created_at desc limit 10;
```

### Appointments and reminders

Book with the test email, confirm it in the dashboard, then cancel a separate confirmed booking. Verify `APPOINTMENT_CONFIRMED` and `APPOINTMENT_CANCELLED` queue rows.

For a disposable reminder test only:

```sql
update public.appointment_reminders
set due_at=now()-interval '1 minute', status='PENDING', attempt_count=0
where id='PASTE_A_TEST_REMINDER_UUID';
```

Run the worker, then inspect:

```sql
select id, appointment_id, reminder_minutes, due_at, status,
       attempt_count, provider_message_id, last_error
from public.appointment_reminders order by created_at desc limit 10;
```

## Operations and troubleshooting

```sql
select 'transactional' as queue,status,count(*) from public.transactional_email_deliveries group by status
union all select 'order',status,count(*) from public.order_email_deliveries group by status
union all select 'appointment',status,count(*) from public.appointment_email_deliveries group by status
union all select 'reminder',status,count(*) from public.appointment_reminders group by status
order by queue,status;
```

- `401`: the endpoint secret is missing, shorter than 16 characters, or does not match.
- `RESEND_API_KEY is not configured`: add it to the invoked environment and redeploy/restart.
- Resend validation error with `onboarding@resend.dev`: send only to the Resend account owner until a domain is verified.
- `Unable to claim email jobs`: apply the full migration and let PostgREST reload its schema.
- Repeated `FAILED`: inspect `last_error`. Jobs stop after three attempts; after correcting the cause, reset only the intended row to `PENDING` and `attempt_count=0`.
- A successful order/appointment with a failed email is intentional: business data remains committed while delivery is retried separately.

## Domain checklist for later

Verify the domain in Resend, publish SPF/DKIM and DMARC, use separate authentication and transactional sender addresses, update both `RESEND_FROM_EMAIL` and Supabase SMTP sender, and test Gmail/Outlook/mobile rendering before increasing volume.
