-- Prevent SharePoint-originated gate-code updates from echoing back to SharePoint.
-- Also marks inbound combinations with their source so loop suppression is durable.

create or replace function public.apply_gate_combination_from_sharepoint(
  p_gate_id uuid,
  p_combination text,
  p_combination_date date
)
returns table(changed boolean, combo_id uuid, reason text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_new_code text;
  v_effective_date date;
  v_valid_from timestamptz;
  v_existing_id uuid;
  v_existing_code text;
  v_existing_date date;
  v_provider_combo_id uuid;
begin
  v_new_code := nullif(trim(coalesce(p_combination, '')), '');
  if v_new_code is null then raise exception 'Gate combination cannot be empty.'; end if;
  v_effective_date := coalesce(p_combination_date,(now() at time zone 'Pacific/Honolulu')::date);

  select gc.id into v_provider_combo_id
  from public.gate_combinations gc
  where gc.gate_id=p_gate_id and gc.credential_source='igloohome'
    and coalesce(nullif(trim(gc.code),''),nullif(trim(gc.combo),''))=v_new_code
    and gc.valid_from=v_effective_date
  order by gc.created_at desc limit 1;

  if v_provider_combo_id is not null then
    return query select false,v_provider_combo_id,'ignored_igloohome_echo'::text; return;
  end if;

  select gc.id,coalesce(nullif(trim(gc.code),''),nullif(trim(gc.combo),'')),gc.valid_from
  into v_existing_id,v_existing_code,v_existing_date
  from public.gate_combinations gc
  where gc.gate_id=p_gate_id and (coalesce(gc.is_active,false) or coalesce(gc.active,false))
  order by gc.created_at desc limit 1;

  if v_existing_id is not null and v_existing_code=v_new_code and v_existing_date=v_effective_date then
    return query select false,v_existing_id,'already_current'::text; return;
  end if;

  v_valid_from := v_effective_date::timestamp at time zone 'Pacific/Honolulu';

  update public.gate_combinations set is_active=false,active=false
  where gate_id=p_gate_id and (coalesce(is_active,false) or coalesce(active,false));

  insert into public.gate_combinations
    (gate_id,code,combo,valid_from,valid_until,is_active,active,credential_source,created_at)
  values
    (p_gate_id,v_new_code,v_new_code,v_valid_from,null,true,true,'sharepoint',now())
  returning id into v_existing_id;

  return query select true,v_existing_id,'updated_from_sharepoint'::text;
end;
$function$;

drop trigger if exists gate_code_sharepoint_sync_insert_trigger on public.gate_combinations;
create trigger gate_code_sharepoint_sync_insert_trigger after insert on public.gate_combinations
for each row when (
  coalesce(new.credential_source,'manual') not in ('igloohome','sharepoint')
  and coalesce(new.is_active,new.active,false)
  and nullif(trim(coalesce(new.code,new.combo,'')),'') is not null
) execute function public.notify_sharepoint_gate_code_change();

drop trigger if exists gate_code_sharepoint_sync_update_trigger on public.gate_combinations;
create trigger gate_code_sharepoint_sync_update_trigger after update of gate_id,combo,code,active,is_active on public.gate_combinations
for each row when (
  coalesce(new.credential_source,'manual') not in ('igloohome','sharepoint')
  and coalesce(new.is_active,new.active,false)
  and nullif(trim(coalesce(new.code,new.combo,'')),'') is not null
  and (
    old.gate_id is distinct from new.gate_id
    or coalesce(old.code,old.combo) is distinct from coalesce(new.code,new.combo)
    or coalesce(old.is_active,old.active,false) is distinct from coalesce(new.is_active,new.active,false)
  )
) execute function public.notify_sharepoint_gate_code_change();
