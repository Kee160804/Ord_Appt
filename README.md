# YuhBusiness

YuhBusiness is a multi-tenant platform for appointment-based and ordering-based
local businesses. It uses Next.js 16 and Supabase Auth/Postgres with row-level
security.

See [Transactional email setup](docs/transactional-email.md) for the Resend,
Supabase, scheduler, and end-to-end testing guide.

See [Legal and privacy readiness](docs/legal-readiness.md) for the implemented
policy surfaces and the operational/legal work required before real payments.

## Local setup

1. Create `.env.local`.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   from the Supabase project Connect dialog.
3. Apply the SQL migrations described in `supabase/README.md`.
4. Run `npm run dev`.

For email confirmation with SSR, set the Supabase confirmation email template
link to:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
```

Add the local and deployed application URLs to Supabase Auth redirect URLs.

## Vercel production setup

`.env.local` is intentionally excluded from Git, so GitHub-to-Vercel deployments
do not receive local environment variables automatically. In the Vercel project,
open **Settings > Environment Variables** and add these variables to Production
(and Preview if preview deployments should use the same Supabase project):

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_ENABLE_DEMO_MODE=false
RESEND_API_KEY
RESEND_FROM_EMAIL
SUPABASE_SECRET_KEY
CRON_SECRET
EMAIL_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL
# Set only after a real server-side billing adapter is installed.
BILLING_PROVIDER
```

Use the same URL and publishable key as `.env.local`. Never place a Supabase
secret/service-role key in a `NEXT_PUBLIC_` variable. Create a new deployment
after changing Vercel environment variables because previous deployments keep
the values that were present when their client bundles were built.

In Supabase, open **Authentication > URL Configuration** and configure:

```text
Site URL: https://yuhbusiness.com
Redirect URL: https://yuhbusiness.com/auth/confirm**
```

Supabase falls back to the configured **Site URL** when an application's
`redirectTo` URL is missing from the Redirect URLs allow-list. If production
confirmation emails open localhost, update both values above and send a new
confirmation email; links generated before the change keep their old target.

The redirect configuration is used by signup confirmation and password recovery.
Password login itself requires the two public Supabase variables above.

Password recovery and confirmation email are sent by Supabase Auth, not by the
application's Resend SDK. Adding `RESEND_API_KEY` to Vercel does not connect
Supabase Auth to Resend: configure Resend SMTP under **Supabase >
Authentication > Notifications > Email > SMTP Settings**. The test sender `YuhBusiness <noreply@yuhbusiness.com>` can send
only to the Resend account owner's address; verify a domain before sending Auth
email to other users.

When Supabase is not configured, development automatically uses the original
mock/demo data. Production never enables the browser-password demo fallback
unless `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` is explicitly set.

## Implemented Supabase paths

- Cookie-based Supabase authentication for browser and server rendering.
- Session refresh and protected-route redirects through Next.js `proxy.ts`.
- Profile, tenant-membership, role, tenant, and business-hours hydration.
- Atomic profile, tenant, membership, and OWNER-role provisioning after signup/email confirmation.
- Product and category reads plus product create, availability, and delete.
- Public storefront tenant, category, product, and service reads through RLS.
- Transactional public appointment booking and ordering checkout.
- Database-backed dashboard appointments, orders, customers, products, services, and analytics.
- Recipient-scoped Supabase Realtime in-app notifications with personal read state and tenant-isolated links.
- Full public ordering checkout for dine-in, pickup, and delivery, including server-authoritative taxes, discounts, fees, minimums, and inventory.
- Protected public order, booking, promotion, and contact APIs with distributed throttling and abuse controls.
- Provider-neutral monthly subscription lifecycle, BZD invoice/payment ledger, automated $2 staff-seat totals, owner cancellation at period end, and an explicitly labelled development mock gateway.
- Reproducible baseline schema for new Supabase projects.

Real-money payments remain disabled until a provider adapter, verified webhook,
sandbox/production credentials, and `BILLING_PROVIDER` are configured. Development
may use `BILLING_PROVIDER=mock`; production rejects mock billing and never silently
activates a mock subscription.
