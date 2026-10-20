begin;

create or replace function public.clinic_load(p_clinic uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare
  entity record;
  list jsonb;
  result jsonb := '{}'::jsonb;
  access jsonb := '{}'::jsonb;
  rev bigint;
  readable boolean;
  slots_access jsonb;
  catalog_slots text[];
  stored_slots text[];
  allowed_slots text[];
  administrator boolean;
begin
  perform private.require_member(p_clinic);
  select revision into rev from public.clinics where id=p_clinic for share;
  perform private.require_member(p_clinic);
  administrator := private.is_admin(p_clinic);
  for entity in select * from private.entity_catalog
    order by (table_name='patient_files'),table_name loop
    catalog_slots := case when cardinality(entity.slots)=0
      then array['cl','hc','meta','avs'] else entity.slots end;
    execute format('select coalesce(array_agg(distinct slot),array[]::text[])
      from public.%I where clinic_id=$1',entity.table_name)
      into stored_slots using p_clinic;
    select coalesce(array_agg(slot_name),array[]::text[]) into allowed_slots
      from (select distinct unnest(catalog_slots || stored_slots) as slot_name) slots
      where private.table_level(p_clinic,entity.table_name,slot_name,false)>=1;
    readable := catalog_slots && allowed_slots;
    execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''parent_id'',parent_id,''slot'',slot,
      ''position'',position,''kind'',kind,''dados'',dados) order by parent_id,slot,position,id),''[]''::jsonb)
      from public.%I where clinic_id=$1 and slot=any($2)',entity.table_name)
      into list using p_clinic,allowed_slots;
    if entity.table_name='patients' and least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.dados'))<1 then
      select coalesce(jsonb_agg(case when row_value->>'kind'='object' then jsonb_set(row_value,'{dados}',
        (row_value->'dados') - array(select jsonb_object_keys(row_value->'dados') except select unnest(array['id','nome'])))
        else row_value end),'[]'::jsonb)
        into list from jsonb_array_elements(list) row_value;
    end if;
    result := result || jsonb_build_object(entity.table_name,list);
    select coalesce(jsonb_object_agg(slot_name,private.table_level(p_clinic,entity.table_name,slot_name,true)>=2),'{}'::jsonb)
      into slots_access from unnest(catalog_slots) slot_name;
    access := access || jsonb_build_object(entity.table_name,jsonb_build_object('read',readable,
      'admin',administrator,'write',slots_access));
  end loop;
  return jsonb_build_object('revision',rev::text,'tables',result,'access',access);
end $$;

commit;