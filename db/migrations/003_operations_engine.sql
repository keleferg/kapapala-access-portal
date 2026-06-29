-- Kapāpala Access Portal v2.2 Operations Engine
-- Adds workflow, business rule, notification, and configuration scaffolding.

create table if not exists public.workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  workflow_key text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  step_key text not null,
  step_name text not null,
  step_order integer not null,
  description text,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  unique(workflow_definition_id, step_key)
);

create table if not exists public.business_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  category text not null,
  name text not null,
  description text,
  rule_value jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  channel text not null check (channel in ('sms','email','sms_email','broadcast_sms')),
  trigger_event text not null,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  audience text not null check (audience in ('user','administrator','both')),
  name text not null,
  priority text not null check (priority in ('low','medium','high','critical')),
  delivery_method text not null,
  trigger_condition jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_configuration (
  id uuid primary key default gen_random_uuid(),
  config_group text not null,
  config_key text not null,
  config_value jsonb not null default '{}'::jsonb,
  description text,
  is_sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(config_group, config_key)
);

alter table public.workflow_definitions enable row level security;
alter table public.workflow_steps enable row level security;
alter table public.business_rules enable row level security;
alter table public.message_templates enable row level security;
alter table public.notification_rules enable row level security;
alter table public.system_configuration enable row level security;

-- Production note: these policies should be restricted to admin role claims before go-live.
create policy if not exists "Admins can read workflow definitions" on public.workflow_definitions for select using (true);
create policy if not exists "Admins can read workflow steps" on public.workflow_steps for select using (true);
create policy if not exists "Admins can read business rules" on public.business_rules for select using (true);
create policy if not exists "Admins can read message templates" on public.message_templates for select using (true);
create policy if not exists "Admins can read notification rules" on public.notification_rules for select using (true);
create policy if not exists "Admins can read system configuration" on public.system_configuration for select using (true);

insert into public.workflow_definitions (workflow_key, name, description)
values
  ('access_account', 'Access Account Workflow', 'Lifecycle for new access account applications and approvals.'),
  ('daily_access', 'Daily Access Workflow', 'Lifecycle for daily gate access requests and SMS delivery.')
on conflict (workflow_key) do nothing;

insert into public.business_rules (rule_key, category, name, description, rule_value)
values
  ('account_validity_months', 'Accounts', 'Access account validity period', 'Approved accounts expire after configured number of months.', '{"months":24}'::jsonb),
  ('public_gates', 'Gates', 'Public gates', 'Gates available for public daily access requests.', '{"gates":["Wood Valley","Honanui","ʻĀinapō"]}'::jsonb),
  ('overnight_permit_required', 'Permits', 'Overnight summit permit required', 'Require State and/or NPS summit permit number for overnight access.', '{"required":true}'::jsonb),
  ('max_party_size_auto_approval', 'Requests', 'Maximum party size for automatic approval', 'Requests above this number route to admin review.', '{"partySize":10}'::jsonb)
on conflict (rule_key) do nothing;

insert into public.message_templates (template_key, name, channel, trigger_event, body)
values
  ('daily_access_approved', 'Daily Access Approved', 'sms', 'daily_request.approved', 'Kapāpala Access approved. Date: {{date}}. Gate: {{gate}}. Combination: {{combo}}. Do not share this code.'),
  ('access_account_approved', 'Access Account Approved', 'sms_email', 'account.approved', 'Your Kapāpala Access Account has been approved. Access ID: {{accessId}}.'),
  ('emergency_closure', 'Emergency Closure', 'broadcast_sms', 'admin.broadcast', 'Kapāpala public access is closed due to {{reason}}. Do not enter until access is reopened.')
on conflict (template_key) do nothing;
