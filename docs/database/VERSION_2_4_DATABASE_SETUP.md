# Kapāpala Access Portal v2.4 Database Setup

## What changed

Version 2.4 replaces the earlier single-schema migration with a Supabase-safe production database foundation.

It fixes the Supabase/PostgreSQL policy syntax issue by using:

```sql
drop policy if exists "Policy Name" on public.table_name;
create policy "Policy Name" on public.table_name ...
```

instead of unsupported `create policy if not exists` syntax.

## How to install

1. Open Supabase.
2. Go to **SQL Editor**.
3. Click **New Query**.
4. Open this file in the project:

```text
supabase/RUN_THIS_IN_SQL_EDITOR.sql
```

5. Copy the entire file.
6. Paste it into Supabase SQL Editor.
7. Click **Run**.

## Expected result

At the bottom of the results, you should see:

```text
Kapapala Access Portal v2.4 database foundation installed successfully.
```

Then open Table Editor and confirm that the following tables exist:

- profiles
- access_accounts
- account_types
- organizations
- purposes
- vehicles
- party_groups
- favorite_requests
- gates
- gate_combinations
- daily_access_requests
- documents
- timeline_events
- sms_logs
- audit_log
- business_rules
- notification_templates

## Seeded gates

The `gates` table should include:

- Wood Valley
- Honanui
- ʻĀinapō

## After install

Open:

```text
http://localhost:3000/api/health
```

You should see Supabase connected and gate records returned.
