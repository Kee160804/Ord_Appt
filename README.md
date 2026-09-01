# LocalSpace

LocalSpace is a multi-tenant platform for appointment-based and ordering-based
local businesses. It uses Next.js 16 and Supabase Auth/Postgres with row-level
security.

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
```

Use the same URL and publishable key as `.env.local`. Never place a Supabase
secret/service-role key in a `NEXT_PUBLIC_` variable. Create a new deployment
after changing Vercel environment variables because previous deployments keep
the values that were present when their client bundles were built.

In Supabase, open **Authentication > URL Configuration** and configure:

```text
Site URL: https://ord-appt.vercel.app
Redirect URL: https://ord-appt.vercel.app/auth/confirm**
```

The redirect configuration is used by signup confirmation and password recovery.
Password login itself requires the two public Supabase variables above.

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

Payments, storage uploads, and staff management remain future integrations.
