# Version 2.3 — Supabase Authentication Setup

## 1. Create or open your Supabase project
Use a development project first. Do not connect production PII until the security checklist is complete.

## 2. Add environment variables
Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Restart Next.js after changing `.env.local`.

## 3. Run SQL
In Supabase SQL Editor, run:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_auth_profile_trigger.sql`
3. `supabase/seed/seed-development.sql`

## 4. Test the app
Visit:

- `/login`
- `/auth-status`
- `/api/health`
- `/api/supabase/status`
- `/admin/auth`

## 5. Create your first admin
Create a login through `/login`, then run this in Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where email = 'your-email@example.com';
```

Use `super_admin` only for the primary system owner.

## Security notes
- Keep `SUPABASE_SERVICE_ROLE_KEY` out of the browser.
- Never commit `.env.local`.
- Admin route protection is scaffolded in v2.3 and will be enforced as database-backed route guards in v2.4/v2.5.
- Gate combinations remain admin-only and should never be embedded in frontend code.
