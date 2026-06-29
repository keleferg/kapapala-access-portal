# Kapāpala Access Portal v2.4 — Production Database Foundation

This package focuses on getting real data into Supabase safely.

## Primary file to run

```text
supabase/RUN_THIS_IN_SQL_EDITOR.sql
```

Paste that file into the Supabase SQL Editor and run it.

## Fixes included

- Removes unsupported `create policy if not exists` syntax.
- Uses `drop policy if exists` before every policy.
- Safe to run after a partial failed v2.0 schema attempt.
- Adds lookup tables for purposes, account types, and organizations.
- Adds gates, combinations, daily requests, vehicles, documents, timeline, SMS logs, audit log, business rules, and notification templates.
- Creates the private `kapapala-documents` Supabase Storage bucket.

## Next step after running SQL

Visit:

```text
http://localhost:3000/api/health
```

Then confirm the `gates` table shows Wood Valley, Honanui, and ʻĀinapō.
