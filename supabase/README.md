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

## Multi-business accounts

Apply `202609010001_multi_business_accounts.sql` after the entitlement and
ordering migrations. It makes `tenant_memberships` the account-to-business
authorization source, adds the authenticated additional-business RPC, and
installs membership-scoped policies for the complete tenant dataset.

One Supabase Auth user may then own multiple businesses without another email
or password. Every new business receives its own OWNER membership, Beginner
plan, 14-day trial, storefront slug, modules, and tenant-level subscription.
The internal database plan value remains `starter` for backward compatibility;
the application displays it as Beginner at $9 BZD per month. Pro is $12 BZD
and Enterprise is $16 BZD, charged independently for each tenant.

## Storefront cover photo uploads

Apply `202609020001_storefront_media_storage.sql` after the multi-business
migration. It creates the public `storefront-media` bucket with a 5 MB limit
for JPG, PNG, and WebP images. Uploads and deletions are restricted to tenant
members through the business ID folder, while the resulting cover image is
publicly readable on that business's storefront.

## Business Team & Access

Apply `202609030001_business_team_access.sql` after the multi-business
migration. It gives each business owner a separate Team & Access area with
fixed Manager and Staff roles, email-bound invitations, single-use expiring
tokens, database-enforced seat limits, and an audit trail.

Staff allowances are enforced per tenant:

- Beginner: owner only; no staff.
- Pro: 1 included staff member, up to 4 staff total.
- Enterprise: 2 included staff members, up to 10 staff total.
- Extra authorized staff seats cost $2 BZD per month per business.

Pending invitations reserve available capacity but are not billed. Paid-seat
requests do not grant capacity until a SUPER_ADMIN confirms payment and
approves the request from the tenant administration page. Deactivating a team
member preserves the membership and audit history.

Team invitations return through `/team/invite`. Add the deployed and local
paths to **Authentication > URL Configuration > Redirect URLs** in Supabase:

```text
http://localhost:3000/team/invite**
https://YOUR_DEPLOYED_DOMAIN/team/invite**
```

The current implementation produces a secure invitation link for the owner to
copy and send. When a transactional email provider is connected, send that
same generated link from a trusted server or Edge Function; never expose a
service-role key in the browser.

If Team & Access was installed on a project containing older tenant rows whose
plan value is `beginner`, apply
`202609030002_normalize_beginner_team_plan.sql`. It changes only that internal
alias to `starter`; it does not change pricing, access status, subscriptions,
memberships, or business data.

## Business growth tools

Apply `202609040001_business_growth_tools.sql` after both Business Team &
Access migrations. It adds owner-managed service providers and schedules,
service departments, tenant notifications, configurable appointment-reminder
tracking, promotions/redemptions, provider-aware booking, and the CRM summary
function. Existing solo booking and ordering RPCs remain in place for a safe
rolling deployment.

The migration keeps every record keyed by `tenant_id`, adds membership/owner
RLS, limits anonymous provider reads to public display fields, and validates
discounts and provider availability in security-definer functions. The app's
Business Tools page also generates storefront QR codes locally in the browser;
QR generation does not upload customer or storefront information elsewhere.

Appointment reminders are placed in `appointment_reminders` only after an
appointment is confirmed. Rows expose `PENDING`, `PROCESSING`, `SENT`,
`FAILED`, and `CANCELLED` status so a configured email/SMS worker can claim and
report deliveries without duplicate scheduling. Until that delivery worker is
connected, the page accurately shows reminders as pending rather than claiming
they were sent.

This repository includes `functions/process-appointment-reminders` as the
delivery worker. Deploy it with `--no-verify-jwt`, configure the existing
Resend secrets plus a long random `REMINDER_CRON_SECRET`, and invoke it every
five minutes with a Supabase scheduled function using the matching
`x-reminder-secret` header. The worker claims due rows before sending, uses a
per-reminder idempotency key, retries failures at most three times, and records
the provider message ID or safe error.

The live super-admin overview requires
`202608260003_super_admin_access.sql`. It installs the database-level platform
role check, prevents browser self-promotion, and adds cross-tenant policies for
the application tables. Assign individual super admins separately by updating
`profiles.platform_role` from a trusted SQL/admin environment.

## Phase One plan entitlements

Apply `202608270002_plan_activity_entitlements.sql` after the tenant trial
migration. It adds the Beginner 50 / Pro 150 / Enterprise unlimited monthly
activity rules, the owner usage RPC, transaction-safe order and appointment
quota triggers, and database guards for Pro-only feature fields. It does not
rewrite or delete existing tenant, order, appointment, product, or service
data.

Run `npm run test:entitlements` only against a staging project with dedicated
fixtures. The script intentionally requires explicit test credentials and IDs:

```text
ENTITLEMENT_TEST_OWNER_EMAIL=
ENTITLEMENT_TEST_OWNER_PASSWORD=
ENTITLEMENT_TEST_EXPIRED_EMAIL=
ENTITLEMENT_TEST_EXPIRED_PASSWORD=
ENTITLEMENT_TEST_EXPIRED_PRODUCT_ID=
ENTITLEMENT_TEST_EXPIRED_SERVICE_ID=
ENTITLEMENT_TEST_APPOINTMENT_DATE=2027-01-15
ENTITLEMENT_TEST_APPOINTMENT_TIME=10:00
ENTITLEMENT_TEST_SUPER_ADMIN_EMAIL=
ENTITLEMENT_TEST_SUPER_ADMIN_PASSWORD=
```

The expired appointment date/time must be a future, open, conflict-free slot
for the fixture tenant so the request reaches the subscription write guard.

## Authentication redirect configuration

Password recovery and email confirmation return through `/auth/confirm`.
Add the local and deployed URLs to **Authentication > URL Configuration >
Redirect URLs** in Supabase, for example:

```text
http://localhost:3000/auth/confirm**
https://YOUR_DEPLOYED_DOMAIN/auth/confirm**
```

Keep the production Site URL set to the deployed HTTPS origin. The application
accepts both Supabase PKCE `code` redirects and token-hash email templates.

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

Run `npm run test:rls`. The live test verifies tenant-scoped table reads, order
updates, anonymous active-only reads, inactive-tenant booking rejection,
cross-tenant public RPC inputs, and transaction rollback safety.

For a real fresh-account check, register a new account through the application,
confirm its email, set `ONBOARDING_TEST_EMAIL` and `ONBOARDING_TEST_PASSWORD`,
then run `npm run test:onboarding`. It verifies the auth user, profile, tenant,
membership, OWNER role, fourteen-day trial, and Beginner entitlement using
that user's JWT.

## Centralized transactional email (current)

Apply `migrations/202609050001_transactional_email_service.sql` after the
business growth migration. Then follow the complete Resend, Vercel, Supabase
Cron, SMTP, webhook, and testing guide in
[`../docs/transactional-email.md`](../docs/transactional-email.md).

The centralized Next.js worker consumes the established order, appointment,
and reminder delivery tables, so no business records are duplicated. The Edge
Function setup below is retained only for a safe rolling deployment and should
be disabled after the central worker is live.

## Legacy appointment confirmation Edge Function

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
RESEND_FROM_EMAIL=YuhBusiness <bookings@your-verified-domain.com>
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
