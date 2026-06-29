-- Kapāpala Access Portal v2.3 development seed data.
-- Safe to run multiple times after schema setup.

insert into public.gates (name, status, road_condition, notes)
values
  ('Wood Valley', 'open', 'Good', 'Primary public entrance gate.'),
  ('Honanui', 'open', 'Fair', 'Public access gate.'),
  ('ʻĀinapō', 'restricted', '4WD recommended', 'Upper forest access; restrictions may apply.')
on conflict (name) do update set
  status = excluded.status,
  road_condition = excluded.road_condition,
  notes = excluded.notes;

insert into public.gate_combinations (gate_id, combo, valid_from, active)
select id, '1234', current_date, true from public.gates where name = 'Wood Valley'
on conflict do nothing;

insert into public.gate_combinations (gate_id, combo, valid_from, active)
select id, '5678', current_date, true from public.gates where name = 'Honanui'
on conflict do nothing;

insert into public.gate_combinations (gate_id, combo, valid_from, active)
select id, '9012', current_date, true from public.gates where name = 'ʻĀinapō'
on conflict do nothing;
