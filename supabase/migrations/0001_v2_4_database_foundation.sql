-- Kapapala Access Portal v2.4 Production Database Foundation
-- Paste this entire file into Supabase SQL Editor and click Run.
-- Safe for a new development Supabase project and safe to rerun after a partial failed v2.0 run.

-- =========================================================
-- 001 Extensions
-- =========================================================
create extension if not exists pgcrypto;

-- =========================================================
-- 002 Enum Types
-- =========================================================
do $$ begin
  create type public.user_role as enum ('public_user', 'admin', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_status as enum ('pending', 'active', 'expired', 'suspended', 'revoked', 'denied');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gate_name as enum ('Wood Valley', 'Honanui', 'ʻĀinapō');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gate_status as enum ('open', 'restricted', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.request_status as enum ('draft', 'pending', 'approved', 'held', 'denied', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_status as enum ('pending', 'verified', 'rejected', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.document_type as enum ('government_id', 'agreement', 'summit_permit', 'insurance', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.sms_status as enum ('queued', 'sent', 'delivered', 'failed');
exception when duplicate_object then null; end $$;

-- =========================================================
-- 003 Core Tables
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  email text,
  phone text,
  role public.user_role not null default 'public_user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.account_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  default_validity_months integer not null default 24,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  organization_type text,
  contact_name text,
  contact_phone text,
  contact_email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.purposes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  requires_summit_permit boolean not null default false,
  requires_organization boolean not null default false,
  requires_admin_review boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.access_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  access_id text unique,
  status public.account_status not null default 'pending',
  account_type text not null default 'Public Access',
  account_type_id uuid references public.account_types(id) on delete set null,
  organization text,
  organization_id uuid references public.organizations(id) on delete set null,
  default_gate public.gate_name,
  emergency_contact_name text,
  emergency_contact_phone text,
  issued_at timestamptz,
  expires_at date,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  access_account_id uuid not null references public.access_accounts(id) on delete cascade,
  label text not null,
  license_plate text not null,
  state text default 'HI',
  make text,
  model text,
  color text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.party_groups (
  id uuid primary key default gen_random_uuid(),
  access_account_id uuid not null references public.access_accounts(id) on delete cascade,
  name text not null,
  party_size integer not null default 1 check (party_size > 0),
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.favorite_requests (
  id uuid primary key default gen_random_uuid(),
  access_account_id uuid not null references public.access_accounts(id) on delete cascade,
  name text not null,
  gate_name public.gate_name,
  purpose_id uuid references public.purposes(id) on delete set null,
  purpose text,
  vehicle_summary text,
  party_size integer not null default 1 check (party_size > 0),
  organization text,
  summit_permit_number text,
  created_at timestamptz not null default now()
);

create table if not exists public.gates (
  id uuid primary key default gen_random_uuid(),
  name public.gate_name not null unique,
  status public.gate_status not null default 'open',
  road_condition text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gate_combinations (
  id uuid primary key default gen_random_uuid(),
  gate_id uuid not null references public.gates(id) on delete cascade,
  combo text not null,
  valid_from date not null,
  valid_to date,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (valid_to is null or valid_to >= valid_from)
);

create table if not exists public.daily_access_requests (
  id uuid primary key default gen_random_uuid(),
  access_account_id uuid not null references public.access_accounts(id) on delete cascade,
  request_date date not null,
  gate_id uuid not null references public.gates(id),
  purpose text not null,
  purpose_id uuid references public.purposes(id) on delete set null,
  party_size integer not null default 1 check (party_size > 0),
  vehicle_summary text,
  emergency_contact_phone text,
  summit_permit_number text,
  organization text,
  organization_id uuid references public.organizations(id) on delete set null,
  status public.request_status not null default 'pending',
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  gate_combination_id uuid references public.gate_combinations(id) on delete set null,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  access_account_id uuid not null references public.access_accounts(id) on delete cascade,
  document_type public.document_type not null,
  file_path text not null,
  file_name text,
  mime_type text,
  file_size_bytes bigint,
  status public.document_status not null default 'pending',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  access_account_id uuid references public.access_accounts(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  event_title text not null,
  event_body text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.sms_logs (
  id uuid primary key default gen_random_uuid(),
  daily_access_request_id uuid references public.daily_access_requests(id) on delete set null,
  access_account_id uuid references public.access_accounts(id) on delete set null,
  phone text not null,
  message_preview text not null,
  provider text not null default 'ClickSend',
  provider_message_id text,
  status public.sms_status not null default 'queued',
  created_at timestamptz not null default now()
);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.business_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  rule_name text not null,
  rule_description text,
  rule_value jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  channel text not null check (channel in ('sms', 'email')),
  subject text,
  body text not null,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- 004 Utility Functions
-- =========================================================
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('admin', 'super_admin')
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.add_timeline_event(
  p_access_account_id uuid,
  p_actor_profile_id uuid,
  p_event_type text,
  p_event_title text,
  p_event_body text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid as $$
declare
  v_event_id uuid;
begin
  insert into public.timeline_events (
    access_account_id,
    actor_profile_id,
    event_type,
    event_title,
    event_body,
    metadata
  )
  values (
    p_access_account_id,
    p_actor_profile_id,
    p_event_type,
    p_event_title,
    p_event_body,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$ language plpgsql security definer set search_path = public;

-- =========================================================
-- 005 Triggers
-- =========================================================
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_access_accounts_updated_at on public.access_accounts;
create trigger set_access_accounts_updated_at
before update on public.access_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_gates_updated_at on public.gates;
create trigger set_gates_updated_at
before update on public.gates
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_requests_updated_at on public.daily_access_requests;
create trigger set_daily_requests_updated_at
before update on public.daily_access_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_business_rules_updated_at on public.business_rules;
create trigger set_business_rules_updated_at
before update on public.business_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_notification_templates_updated_at on public.notification_templates;
create trigger set_notification_templates_updated_at
before update on public.notification_templates
for each row execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- 006 Indexes
-- =========================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_access_accounts_profile_id on public.access_accounts(profile_id);
create index if not exists idx_access_accounts_access_id on public.access_accounts(access_id);
create index if not exists idx_access_accounts_status on public.access_accounts(status);
create index if not exists idx_access_accounts_expires_at on public.access_accounts(expires_at);
create index if not exists idx_vehicles_access_account_id on public.vehicles(access_account_id);
create index if not exists idx_vehicles_license_plate on public.vehicles(license_plate);
create index if not exists idx_daily_requests_access_account_id on public.daily_access_requests(access_account_id);
create index if not exists idx_daily_requests_date on public.daily_access_requests(request_date);
create index if not exists idx_daily_requests_status on public.daily_access_requests(status);
create index if not exists idx_daily_requests_gate_id on public.daily_access_requests(gate_id);
create index if not exists idx_documents_access_account_id on public.documents(access_account_id);
create index if not exists idx_timeline_access_account_id on public.timeline_events(access_account_id);
create index if not exists idx_timeline_created_at on public.timeline_events(created_at desc);
create index if not exists idx_sms_logs_daily_request on public.sms_logs(daily_access_request_id);
create index if not exists idx_sms_logs_created_at on public.sms_logs(created_at desc);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);

-- =========================================================
-- 007 Seed Data
-- =========================================================
insert into public.gates (name, status, road_condition, notes)
values
  ('Wood Valley', 'open', 'Good', 'Primary public entrance gate.'),
  ('Honanui', 'open', 'Fair', 'Public access gate.'),
  ('ʻĀinapō', 'restricted', '4WD recommended', 'Upper forest access; restrictions may apply.')
on conflict (name) do update set
  status = excluded.status,
  road_condition = excluded.road_condition,
  notes = excluded.notes;

insert into public.account_types (name, description, default_validity_months)
values
  ('Public Access', 'Standard public access account.', 24),
  ('Frequent User', 'Frequent access user with saved request defaults.', 24),
  ('Research', 'Research or agency access account.', 24),
  ('Cultural Access', 'Cultural practitioner access account.', 24),
  ('Contractor', 'Contractor or service provider access account.', 12)
on conflict (name) do update set
  description = excluded.description,
  default_validity_months = excluded.default_validity_months;

insert into public.purposes (name, description, requires_summit_permit, requires_organization, requires_admin_review, sort_order)
values
  ('Hunting', 'Hunting access.', false, false, false, 10),
  ('Hiking', 'Hiking or recreational access.', false, false, false, 20),
  ('Cultural Access', 'Cultural access or practice.', false, false, false, 30),
  ('Research', 'Research, monitoring, or agency work.', false, true, true, 40),
  ('Ranch Business', 'Ranch-related business or work.', false, false, false, 50),
  ('Property Access', 'Access to private or permitted property interest.', false, false, false, 60),
  ('Overnight / Summit', 'Overnight or summit-related access.', true, false, true, 70),
  ('Other', 'Other purpose requiring explanation.', false, false, true, 100)
on conflict (name) do update set
  description = excluded.description,
  requires_summit_permit = excluded.requires_summit_permit,
  requires_organization = excluded.requires_organization,
  requires_admin_review = excluded.requires_admin_review,
  sort_order = excluded.sort_order;

insert into public.business_rules (rule_key, rule_name, rule_description, rule_value)
values
  ('access_account_validity_months', 'Access account validity period', 'Default number of months an approved public access account remains valid.', '{"months":24}'::jsonb),
  ('daily_request_allow_same_day', 'Allow same-day daily access requests', 'Controls whether users can request access for today.', '{"enabled":true}'::jsonb),
  ('max_party_size_default', 'Default maximum party size', 'Default maximum number of persons in a daily access request unless overridden.', '{"max":10}'::jsonb),
  ('summit_permit_required_for_overnight', 'Summit permit required for overnight access', 'Requires a summit/NPS permit number when overnight or summit purpose is selected.', '{"enabled":true}'::jsonb)
on conflict (rule_key) do update set
  rule_name = excluded.rule_name,
  rule_description = excluded.rule_description,
  rule_value = excluded.rule_value;

insert into public.notification_templates (template_key, channel, subject, body)
values
  ('access_account_approved_sms', 'sms', null, 'Kapāpala Access Account approved. Access ID: {{access_id}}. Please log in to request daily access.'),
  ('daily_access_approved_sms', 'sms', null, 'Kapāpala access approved for {{date}} via {{gate}}. Gate combination: {{combo}}. Do not share this code.'),
  ('daily_access_denied_sms', 'sms', null, 'Your Kapāpala access request for {{date}} was not approved. Please contact Kapāpala Ranch for assistance.'),
  ('account_expiration_reminder_sms', 'sms', null, 'Your Kapāpala Access Account expires on {{expires_at}}. Please renew before requesting future access.')
on conflict (template_key) do update set
  channel = excluded.channel,
  subject = excluded.subject,
  body = excluded.body;

-- =========================================================
-- 008 Row Level Security
-- =========================================================
alter table public.profiles enable row level security;
alter table public.account_types enable row level security;
alter table public.organizations enable row level security;
alter table public.purposes enable row level security;
alter table public.access_accounts enable row level security;
alter table public.vehicles enable row level security;
alter table public.party_groups enable row level security;
alter table public.favorite_requests enable row level security;
alter table public.gates enable row level security;
alter table public.gate_combinations enable row level security;
alter table public.daily_access_requests enable row level security;
alter table public.documents enable row level security;
alter table public.timeline_events enable row level security;
alter table public.sms_logs enable row level security;
alter table public.audit_log enable row level security;
alter table public.business_rules enable row level security;
alter table public.notification_templates enable row level security;

-- Profiles
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "Admins can manage profiles" on public.profiles;
create policy "Admins can manage profiles" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

-- Public lookup tables readable by authenticated users; managed by admins
drop policy if exists "Authenticated users can read account types" on public.account_types;
create policy "Authenticated users can read account types" on public.account_types
for select using (auth.uid() is not null);

drop policy if exists "Admins can manage account types" on public.account_types;
create policy "Admins can manage account types" on public.account_types
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can read organizations" on public.organizations;
create policy "Authenticated users can read organizations" on public.organizations
for select using (auth.uid() is not null);

drop policy if exists "Admins can manage organizations" on public.organizations;
create policy "Admins can manage organizations" on public.organizations
for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Authenticated users can read purposes" on public.purposes;
create policy "Authenticated users can read purposes" on public.purposes
for select using (auth.uid() is not null);

drop policy if exists "Admins can manage purposes" on public.purposes;
create policy "Admins can manage purposes" on public.purposes
for all using (public.is_admin()) with check (public.is_admin());

-- Access Accounts
drop policy if exists "Users can read own access account" on public.access_accounts;
create policy "Users can read own access account" on public.access_accounts
for select using (profile_id = auth.uid() or public.is_admin());

drop policy if exists "Users can create own pending access account" on public.access_accounts;
create policy "Users can create own pending access account" on public.access_accounts
for insert with check (profile_id = auth.uid());

drop policy if exists "Users can update own pending access account" on public.access_accounts;
create policy "Users can update own pending access account" on public.access_accounts
for update using (profile_id = auth.uid() and status = 'pending')
with check (profile_id = auth.uid() and status = 'pending');

drop policy if exists "Admins can manage access accounts" on public.access_accounts;
create policy "Admins can manage access accounts" on public.access_accounts
for all using (public.is_admin()) with check (public.is_admin());

-- Vehicles
drop policy if exists "Users can read own vehicles" on public.vehicles;
create policy "Users can read own vehicles" on public.vehicles
for select using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Users can manage own vehicles" on public.vehicles;
create policy "Users can manage own vehicles" on public.vehicles
for all using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
) with check (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
);

drop policy if exists "Admins can manage vehicles" on public.vehicles;
create policy "Admins can manage vehicles" on public.vehicles
for all using (public.is_admin()) with check (public.is_admin());

-- Party Groups
drop policy if exists "Users can manage own party groups" on public.party_groups;
create policy "Users can manage own party groups" on public.party_groups
for all using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
) with check (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

-- Favorites
drop policy if exists "Users can manage own favorite requests" on public.favorite_requests;
create policy "Users can manage own favorite requests" on public.favorite_requests
for all using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
) with check (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

-- Gates
drop policy if exists "Authenticated users can read gates" on public.gates;
create policy "Authenticated users can read gates" on public.gates
for select using (auth.uid() is not null);

drop policy if exists "Admins can manage gates" on public.gates;
create policy "Admins can manage gates" on public.gates
for all using (public.is_admin()) with check (public.is_admin());

-- Gate combinations only admins can read/manage. Users receive combos only through approved workflow.
drop policy if exists "Admins can manage gate combinations" on public.gate_combinations;
create policy "Admins can manage gate combinations" on public.gate_combinations
for all using (public.is_admin()) with check (public.is_admin());

-- Daily Access Requests
drop policy if exists "Users can read own daily requests" on public.daily_access_requests;
create policy "Users can read own daily requests" on public.daily_access_requests
for select using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Users can create own daily requests" on public.daily_access_requests;
create policy "Users can create own daily requests" on public.daily_access_requests
for insert with check (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
);

drop policy if exists "Admins can manage daily requests" on public.daily_access_requests;
create policy "Admins can manage daily requests" on public.daily_access_requests
for all using (public.is_admin()) with check (public.is_admin());

-- Documents
drop policy if exists "Users can read own documents" on public.documents;
create policy "Users can read own documents" on public.documents
for select using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Users can upload own documents" on public.documents;
create policy "Users can upload own documents" on public.documents
for insert with check (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
);

drop policy if exists "Admins can manage documents" on public.documents;
create policy "Admins can manage documents" on public.documents
for all using (public.is_admin()) with check (public.is_admin());

-- Timeline
drop policy if exists "Users can read own timeline" on public.timeline_events;
create policy "Users can read own timeline" on public.timeline_events
for select using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Admins can manage timeline" on public.timeline_events;
create policy "Admins can manage timeline" on public.timeline_events
for all using (public.is_admin()) with check (public.is_admin());

-- SMS logs admin-only
drop policy if exists "Admins can manage sms logs" on public.sms_logs;
create policy "Admins can manage sms logs" on public.sms_logs
for all using (public.is_admin()) with check (public.is_admin());

-- Audit log admin-only
drop policy if exists "Admins can read audit log" on public.audit_log;
create policy "Admins can read audit log" on public.audit_log
for select using (public.is_admin());

drop policy if exists "Admins can insert audit log" on public.audit_log;
create policy "Admins can insert audit log" on public.audit_log
for insert with check (public.is_admin());

-- Business rules admin-only
drop policy if exists "Admins can manage business rules" on public.business_rules;
create policy "Admins can manage business rules" on public.business_rules
for all using (public.is_admin()) with check (public.is_admin());

-- Notification templates admin-only
drop policy if exists "Admins can manage notification templates" on public.notification_templates;
create policy "Admins can manage notification templates" on public.notification_templates
for all using (public.is_admin()) with check (public.is_admin());

-- =========================================================
-- 009 Storage Bucket for Private Documents
-- =========================================================
insert into storage.buckets (id, name, public)
values ('kapapala-documents', 'kapapala-documents', false)
on conflict (id) do update set public = false;

-- Storage policies for private document bucket
drop policy if exists "Users can upload own account documents" on storage.objects;
create policy "Users can upload own account documents" on storage.objects
for insert with check (
  bucket_id = 'kapapala-documents'
  and auth.uid() is not null
);

drop policy if exists "Admins can manage kapapala documents" on storage.objects;
create policy "Admins can manage kapapala documents" on storage.objects
for all using (
  bucket_id = 'kapapala-documents'
  and public.is_admin()
) with check (
  bucket_id = 'kapapala-documents'
  and public.is_admin()
);

-- =========================================================
-- Done
-- =========================================================
select 'Kapapala Access Portal v2.4 database foundation installed successfully.' as result;
