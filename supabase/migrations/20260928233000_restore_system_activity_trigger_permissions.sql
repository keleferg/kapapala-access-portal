-- The server creates profiles using service_role. Its profile audit trigger
-- writes to this private table, so grant only the missing INSERT privilege.
-- Do not grant reads, updates, deletes, or privileges to browser roles.
grant insert on table public.system_activity_log to service_role;
