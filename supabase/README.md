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
