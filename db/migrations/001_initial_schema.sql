-- Kapāpala Access Portal v2.0 Backend Foundation
-- Run this in Supabase SQL Editor for the development project.

create extension if not exists pgcrypto;

-- ==============================
-- Enum Types
-- ==============================
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

-- ==============================
-- Utility Functions
-- ==============================
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
    select 1 from public.profiles
    where id = auth.uid()
    and role in ('admin', 'super_admin')
  );
$$ language sql stable security definer;

-- ==============================
-- Core Tables
-- ==============================
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

create table if not exists public.access_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  access_id text unique,
  status public.account_status not null default 'pending',
  account_type text not null default 'Public Access',
  organization text,
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

create table if not exists public.gates (
  id uuid primary key default gen_random_uuid(),
  name public.gate_name not null unique,
  status public.gate_status not null default 'open',
  road_condition text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
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
  party_size integer not null default 1 check (party_size > 0),
  vehicle_summary text,
  emergency_contact_phone text,
  summit_permit_number text,
  organization text,
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
  phone text not null,
  message_preview text not null,
  provider text not null default 'ClickSend',
  provider_message_id text,
  status public.sms_status not null default 'queued',
  created_at timestamptz not null default now()
);

-- ==============================
-- Triggers
-- ==============================
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_access_accounts_updated_at on public.access_accounts;
create trigger set_access_accounts_updated_at before update on public.access_accounts
for each row execute function public.set_updated_at();

drop trigger if exists set_daily_requests_updated_at on public.daily_access_requests;
create trigger set_daily_requests_updated_at before update on public.daily_access_requests
for each row execute function public.set_updated_at();

-- ==============================
-- Seed Gates
-- ==============================
insert into public.gates (name, status, road_condition, notes)
values
  ('Wood Valley', 'open', 'Good', 'Primary public entrance gate.'),
  ('Honanui', 'open', 'Fair', 'Public access gate.'),
  ('ʻĀinapō', 'restricted', '4WD recommended', 'Upper forest access; restrictions may apply.')
on conflict (name) do update set
  status = excluded.status,
  road_condition = excluded.road_condition,
  notes = excluded.notes;

-- ==============================
-- Row Level Security
-- ==============================
alter table public.profiles enable row level security;
alter table public.access_accounts enable row level security;
alter table public.vehicles enable row level security;
alter table public.gates enable row level security;
alter table public.gate_combinations enable row level security;
alter table public.daily_access_requests enable row level security;
alter table public.documents enable row level security;
alter table public.timeline_events enable row level security;
alter table public.sms_logs enable row level security;

-- Profiles
create policy if not exists "Users can read own profile" on public.profiles
for select using (id = auth.uid() or public.is_admin());

create policy if not exists "Users can update own profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy if not exists "Admins can manage profiles" on public.profiles
for all using (public.is_admin()) with check (public.is_admin());

-- Access Accounts
create policy if not exists "Users can read own access account" on public.access_accounts
for select using (profile_id = auth.uid() or public.is_admin());

create policy if not exists "Users can create own pending access account" on public.access_accounts
for insert with check (profile_id = auth.uid());

create policy if not exists "Admins can manage access accounts" on public.access_accounts
for all using (public.is_admin()) with check (public.is_admin());

-- Vehicles
create policy if not exists "Users can read own vehicles" on public.vehicles
for select using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

create policy if not exists "Users can manage own vehicles" on public.vehicles
for all using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
) with check (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
);

create policy if not exists "Admins can manage vehicles" on public.vehicles
for all using (public.is_admin()) with check (public.is_admin());

-- Gates readable by authenticated users; managed by admins
create policy if not exists "Authenticated users can read gates" on public.gates
for select using (auth.uid() is not null);

create policy if not exists "Admins can manage gates" on public.gates
for all using (public.is_admin()) with check (public.is_admin());

-- Gate combinations only admins can read/manage. Users receive combos only through approved workflow.
create policy if not exists "Admins can manage gate combinations" on public.gate_combinations
for all using (public.is_admin()) with check (public.is_admin());

-- Daily requests
create policy if not exists "Users can read own daily requests" on public.daily_access_requests
for select using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

create policy if not exists "Users can create own daily requests" on public.daily_access_requests
for insert with check (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
);

create policy if not exists "Admins can manage daily requests" on public.daily_access_requests
for all using (public.is_admin()) with check (public.is_admin());

-- Documents
create policy if not exists "Users can read own documents" on public.documents
for select using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

create policy if not exists "Users can upload own documents" on public.documents
for insert with check (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
);

create policy if not exists "Admins can manage documents" on public.documents
for all using (public.is_admin()) with check (public.is_admin());

-- Timeline and SMS logs are admin-readable; users can read timeline connected to own account.
create policy if not exists "Users can read own timeline" on public.timeline_events
for select using (
  exists(select 1 from public.access_accounts aa where aa.id = access_account_id and aa.profile_id = auth.uid())
  or public.is_admin()
);

create policy if not exists "Admins can manage timeline" on public.timeline_events
for all using (public.is_admin()) with check (public.is_admin());

create policy if not exists "Admins can manage sms logs" on public.sms_logs
for all using (public.is_admin()) with check (public.is_admin());
