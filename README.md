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

When Supabase is not configured, development automatically uses the original
mock/demo data. Production never enables the browser-password demo fallback
unless `NEXT_PUBLIC_ENABLE_DEMO_MODE=true` is explicitly set.

## Implemented Supabase paths

- Cookie-based Supabase authentication for browser and server rendering.
- Session refresh and protected-route redirects through Next.js `proxy.ts`.
- Profile, tenant-membership, role, tenant, and business-hours hydration.
- New-business provisioning after signup/email confirmation.
- Product and category reads plus product create, availability, and delete.
- Public storefront tenant, category, product, and service reads through RLS.

Appointments, orders, payments, analytics, settings, and staff management still
need to be migrated from their mock UI state to database-backed services.
