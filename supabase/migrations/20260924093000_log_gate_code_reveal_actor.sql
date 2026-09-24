-- Record the authenticated actor whenever a user reveals a gate code.
-- This lets get_admin_system_activity_log resolve and display the revealer's name.

create or replace function public.log_gate_code_reveal(
  p_request_id uuid,
  p_gate_name text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_access_account_id uuid;
  v_gate_id uuid;
  v_request_number text;
  v_request_date date;
  v_gate_name text;
  v_reveal_id uuid;
  v_actor_profile_id uuid := auth.uid();
  v_actor_access_account_id uuid;
  v_actor_email text;
  v_actor_role text;
begin
  select
    dar.access_account_id,
    dar.gate_id,
    dar.request_number,
    dar.request_date,
    coalesce(g.name::text, nullif(trim(coalesce(p_gate_name, '')), ''))
  into
    v_access_account_id,
    v_gate_id,
    v_request_number,
    v_request_date,
    v_gate_name
  from public.daily_access_requests dar
  left join public.gates g
    on g.id = dar.gate_id
  where dar.id = p_request_id;

  if v_actor_profile_id is not null then
    select
      aa.id,
      p.email,
      coalesce(aa.app_role::text, p.role::text)
    into
      v_actor_access_account_id,
      v_actor_email,
      v_actor_role
    from public.profiles p
    left join public.access_accounts aa
      on aa.profile_id = p.id
    where p.id = v_actor_profile_id
    order by
      case when aa.id = v_access_account_id then 0 else 1 end,
      aa.created_at desc nulls last
    limit 1;
  end if;

  insert into public.gate_code_reveals (
    request_id,
    gate_name,
    revealed_at
  )
  values (
    p_request_id,
    nullif(trim(coalesce(v_gate_name, p_gate_name, '')), ''),
    now()
  )
  returning id into v_reveal_id;

  perform public.log_system_activity(
    p_action := 'gate_code_revealed',
    p_summary := 'Gate code was revealed for access request '
      || coalesce(v_request_number, p_request_id::text)
      || '.',
    p_entity_type := 'gate_code_reveal',
    p_entity_id := v_reveal_id,
    p_request_id := p_request_id,
    p_access_account_id := v_access_account_id,
    p_gate_id := v_gate_id,
    p_actor_profile_id := v_actor_profile_id,
    p_actor_access_account_id := v_actor_access_account_id,
    p_actor_email := v_actor_email,
    p_actor_role := v_actor_role,
    p_severity := 'info',
    p_details := jsonb_build_object(
      'reveal_id', v_reveal_id,
      'request_number', v_request_number,
      'request_date', v_request_date,
      'gate_name', v_gate_name
    ),
    p_source := 'database_rpc'
  );
end;
$function$;
