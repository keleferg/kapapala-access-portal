# Kapāpala Access Portal v2.2 — Operations Engine

Version 2.2 begins the shift from static UI pages to operational workflows.

## What this version adds

- Workflow Engine UI
- Business Rules UI
- Communications Center UI
- Notification Framework UI
- Configuration Management UI
- Operations configuration library
- Workflow event helper functions
- Supabase migration scaffold for operational configuration tables

## Operational workflows

### Access Account Workflow

1. Application Submitted
2. Admin Review
3. Needs More Information, if required
4. Approved
5. Account Active

### Daily Access Workflow

1. Request Submitted
2. Account Validation
3. Business Rule Validation
4. Gate Combination Lookup
5. Approved + SMS Sent

## Security note

The migration includes permissive read policies only as a development scaffold. Before production, all admin configuration tables must be restricted using Supabase auth role claims and RLS policies.

## Next version recommendation

v2.3 should connect the Access Account Request Queue to Supabase and make one workflow real end-to-end:

- Submit application
- Store in database
- Admin review
- Approve
- Generate Access ID
- Write timeline event
