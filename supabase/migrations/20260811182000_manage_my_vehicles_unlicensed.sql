-- Manage My Vehicles
-- Adds explicit support for unlicensed ATV/UTV vehicles.

alter table public.vehicles
  alter column license_plate drop not null;

alter table public.vehicles
  add column if not exists is_unlicensed_vehicle boolean not null default false;

alter table public.vehicles
  drop constraint if exists vehicles_license_plate_requirement_check;

alter table public.vehicles
  add constraint vehicles_license_plate_requirement_check
  check (
    (
      is_unlicensed_vehicle = true
      and license_plate is null
      and state is null
    )
    or
    (
      is_unlicensed_vehicle = false
      and nullif(trim(license_plate), '') is not null
    )
  ) not valid;

comment on column public.vehicles.is_unlicensed_vehicle is
  'True for unlicensed ATV/UTV vehicles that do not have a license plate or registration state.';
