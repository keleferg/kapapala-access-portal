# Supabase Setup — Kapāpala Access Portal v2.0

## 1. Create Supabase Project

Create a development project in Supabase.

Recommended name:

```text
kapapala-access-portal-dev
```

## 2. Copy Environment Variables

Create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

Then fill in:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Use the anon key for browser/client operations and the service role key only for server-side admin API routes.

## 3. Run Database Schema

Open Supabase SQL Editor and run:

```text
db/schema.sql
```

This creates:

- profiles
- access_accounts
- vehicles
- gates
- gate_combinations
- daily_access_requests
- documents
- timeline_events
- sms_logs

It also creates enum types, seed gates, triggers, and Row Level Security policies.

## 4. Storage Buckets

Create these Supabase Storage buckets:

```text
id-documents
agreements
permits
account-documents
```

Recommended initial access:

- Private buckets
- Users may upload documents tied to their own access account
- Admins may review and manage all documents

## 5. Authentication

Enable email/password authentication in Supabase Auth.

Future production settings:

- Confirm email: enabled
- Password reset: enabled
- Redirect URL: `https://your-domain.com/auth/callback`
- Local redirect URL: `http://localhost:3000/auth/callback`

## 6. First Admin User

After creating your first user, manually update their role in Supabase SQL Editor:

```sql
update public.profiles
set role = 'super_admin'
where email = 'your-email@example.com';
```

## 7. Health Check

After configuring `.env.local`, start the app:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/api/health
```

Expected result:

```json
{
  "status": "ok",
  "supabase": "connected"
}
```
