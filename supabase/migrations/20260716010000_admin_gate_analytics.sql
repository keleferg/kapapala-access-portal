create index if not exists gate_code_reveals_request_id_idx
  on public.gate_code_reveals (request_id);

create index if not exists daily_access_requests_created_at_idx
  on public.daily_access_requests (created_at);

create or replace function public.get_admin_gate_analytics(
  p_range text default '30'
)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with params as (
    select
      case
        when p_range in ('30', '90', '365', 'ytd') then p_range
        else '30'
      end as range_key,
      (now() at time zone 'Pacific/Honolulu')::date as end_date
  ),

  bounds as (
    select
      range_key,
      end_date,
      case range_key
        when '30' then end_date - 29
        when '90' then end_date - 89
        when '365' then end_date - 364
        when 'ytd' then date_trunc('year', end_date)::date
        else end_date - 29
      end as start_date
    from params
  ),

  request_rows as (
    select
      dar.id,
      dar.gate_id,
      (
        dar.created_at at time zone 'Pacific/Honolulu'
      )::date as submitted_date,
      exists (
        select 1
        from public.gate_code_reveals gcr
        where gcr.request_id = dar.id
      ) as code_viewed
    from public.daily_access_requests dar
    cross join bounds b
    where dar.created_at >= (
      b.start_date::timestamp at time zone 'Pacific/Honolulu'
    )
      and dar.created_at < (
        (b.end_date + 1)::timestamp at time zone 'Pacific/Honolulu'
      )
  ),

  calendar as (
    select generated_day::date as activity_date
    from bounds b
    cross join lateral generate_series(
      b.start_date,
      b.end_date,
      interval '1 day'
    ) generated_day
  ),

  daily_activity as (
    select
      c.activity_date,
      count(rr.id)::integer as requests_submitted,
      (
        count(rr.id) filter (
          where rr.code_viewed
        )
      )::integer as codes_viewed
    from calendar c
    left join request_rows rr
      on rr.submitted_date = c.activity_date
    group by c.activity_date
  ),

  gate_totals as (
    select
      g.id as gate_id,
      g.name::text as gate_name,
      count(rr.id)::integer as requests,
      round(
        count(rr.id)::numeric /
        nullif(
          (b.end_date - b.start_date + 1)::numeric,
          0
        ),
        2
      ) as daily_average
    from public.gates g
    cross join bounds b
    left join request_rows rr
      on rr.gate_id = g.id
    where coalesce(g.active, true) = true
    group by
      g.id,
      g.name,
      b.start_date,
      b.end_date
  ),

  totals as (
    select
      count(*)::integer as requests,
      (
        count(*) filter (
          where code_viewed
        )
      )::integer as viewed
    from request_rows
  )

  select jsonb_build_object(
    'range',
    b.range_key,
    'start_date',
    to_char(b.start_date, 'YYYY-MM-DD'),
    'end_date',
    to_char(b.end_date, 'YYYY-MM-DD'),
    'days',
    b.end_date - b.start_date + 1,
    'totals',
    jsonb_build_object(
      'requests',
      t.requests,
      'viewed',
      t.viewed
    ),
    'daily',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'date',
            to_char(d.activity_date, 'YYYY-MM-DD'),
            'requests_submitted',
            d.requests_submitted,
            'codes_viewed',
            d.codes_viewed
          )
          order by d.activity_date
        )
        from daily_activity d
      ),
      '[]'::jsonb
    ),
    'by_gate',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'gate_id',
            gt.gate_id,
            'gate_name',
            gt.gate_name,
            'requests',
            gt.requests,
            'daily_average',
            gt.daily_average
          )
          order by gt.gate_name
        )
        from gate_totals gt
      ),
      '[]'::jsonb
    )
  )
  from bounds b
  cross join totals t;
$function$;

revoke all
on function public.get_admin_gate_analytics(text)
from public;

grant execute
on function public.get_admin_gate_analytics(text)
to authenticated;
