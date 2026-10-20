begin;

create index if not exists patient_files_patient_cursor_idx on public.patient_files(clinic_id,parent_id,id);

create function private.read_revision(p_clinic uuid,p_revision bigint default null) returns bigint
language plpgsql security definer set search_path=pg_catalog as $$
declare current_revision bigint;
begin
  perform private.require_member(p_clinic);
  select revision into current_revision from public.clinics where id=p_clinic for share;
  perform private.require_member(p_clinic);
  if p_revision is not null and current_revision<>p_revision then
    raise exception using errcode='40001',message='CLOUD_CONFLICT: clinic changed during read';
  end if;
  return current_revision;
end $$;

create function public.clinic_load_start(p_clinic uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare entity record; rev bigint; access jsonb:='{}'; slots text[]; writable jsonb; readable boolean;
begin
  rev:=private.read_revision(p_clinic);
  for entity in select * from private.entity_catalog order by table_name loop
    slots:=case when cardinality(entity.slots)=0 then array['cl','hc','meta','avs'] else entity.slots end;
    select bool_or(private.table_level(p_clinic,entity.table_name,slot_name,false)>=1),
      jsonb_object_agg(slot_name,private.table_level(p_clinic,entity.table_name,slot_name,true)>=2)
      into readable,writable from unnest(slots) slot_name;
    access:=access||jsonb_build_object(entity.table_name,jsonb_build_object('read',readable,
      'admin',private.is_admin(p_clinic),'write',writable));
  end loop;
  return jsonb_build_object('protocol',2,'revision',rev::text,'access',access);
end $$;

create function private.read_row(p_clinic uuid,p_table text,p_row jsonb,p_metadata boolean) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare contents jsonb:=p_row->'dados';
begin
  if p_table='patients' and p_row->>'kind'='object'
    and least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.dados'))<1 then
    contents:=contents-array(select jsonb_object_keys(contents) except select unnest(array['id','nome']));
  elsif p_metadata and p_table='patient_files' then
    if p_row->>'slot'='arquivos' and p_row->>'kind'='object' then
      contents:=jsonb_build_object('id',contents->'id','nome',contents->'nome','tipo',contents->'tipo',
        'categoria',contents->'categoria','dataEnvio',contents->'dataEnvio');
    else contents:='null'::jsonb;
    end if;
  end if;
  return jsonb_set(p_row,'{dados}',contents);
end $$;

create function private.read_page(p_clinic uuid,p_revision bigint,p_table text,p_after text,p_parent text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare entity record; item record; rev bigint; rows jsonb:='[]'; encoded jsonb;
  cursor_id text:=p_after; scanned integer:=0; bytes integer:=0; row_bytes integer; more boolean:=false;
begin
  if p_revision is null then raise exception using errcode='22023',message='REVISION_REQUIRED'; end if;
  rev:=private.read_revision(p_clinic,p_revision);
  select * into entity from private.entity_catalog where table_name=p_table;
  if not found then raise exception using errcode='22023',message='INVALID_TABLE'; end if;
  for item in execute format('select id,parent_id,slot,position,kind,dados from public.%I
    where clinic_id=$1 and ($2::text is null or id>$2)
      and ($3::text is null or parent_id=$3) order by id limit 101',p_table)
    using p_clinic,p_after,p_parent loop
    scanned:=scanned+1;
    if scanned>100 then more:=true; exit; end if;
    if private.table_level(p_clinic,p_table,item.slot,false)>=1 then
      encoded:=private.read_row(p_clinic,p_table,to_jsonb(item),p_table='patient_files');
      row_bytes:=octet_length(encoded::text);
      if bytes+row_bytes>524288 and jsonb_array_length(rows)>0 then more:=true; exit; end if;
      if row_bytes>524288 then encoded:=jsonb_build_object('id',item.id,'chunked',true); end if;
      rows:=rows||jsonb_build_array(encoded);
      bytes:=bytes+octet_length(encoded::text);
    end if;
    cursor_id:=item.id;
  end loop;
  return jsonb_build_object('revision',rev::text,'rows',rows,'next',case when more then cursor_id else null end);
end $$;

create function public.clinic_load_page(p_clinic uuid,p_revision bigint,p_table text,p_after text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
  if p_table='patient_files' then raise exception using errcode='22023',message='USE_PATIENT_FILES_PAGE'; end if;
  return private.read_page(p_clinic,p_revision,p_table,p_after,null);
end $$;

create function public.clinic_files_page(p_clinic uuid,p_revision bigint,p_patient text,p_after text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
  if p_patient is null then raise exception using errcode='22023',message='PATIENT_REQUIRED'; end if;
  return private.read_page(p_clinic,p_revision,'patient_files',p_after,p_patient);
end $$;

create function public.clinic_row_chunk(p_clinic uuid,p_revision bigint,p_table text,p_id text,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare rev bigint; item record; serialized text; next_offset integer;
begin
  if p_revision is null or p_offset is null or p_offset<0 then
    raise exception using errcode='22023',message='INVALID_CHUNK';
  end if;
  rev:=private.read_revision(p_clinic,p_revision);
  if not exists(select 1 from private.entity_catalog where table_name=p_table) then
    raise exception using errcode='22023',message='INVALID_TABLE';
  end if;
  execute format('select id,parent_id,slot,position,kind,dados from public.%I where clinic_id=$1 and id=$2',p_table)
    into item using p_clinic,p_id;
  if item.id is null or private.table_level(p_clinic,p_table,item.slot,false)<1 then
    raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: row unavailable';
  end if;
  serialized:=private.read_row(p_clinic,p_table,to_jsonb(item),false)::text;
  if p_offset>length(serialized) then raise exception using errcode='22023',message='INVALID_CHUNK_OFFSET'; end if;
  next_offset:=least(p_offset+65536,length(serialized));
  return jsonb_build_object('revision',rev::text,'text',substring(serialized from p_offset+1 for 65536),
    'next',case when next_offset<length(serialized) then next_offset else null end);
end $$;

create function public.clinic_file_apply(p_clinic uuid,p_revision bigint,p_patient text,p_operation text,p_data jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare rev bigint; changes jsonb:='[]'; item record; next_position integer; marker text;
  slot_name text; row_id text; value jsonb;
begin
  perform private.require_member(p_clinic);
  select revision into rev from public.clinics where id=p_clinic for update;
  perform private.require_member(p_clinic);
  if p_revision is null or rev<>p_revision then
    raise exception using errcode='40001',message='CLOUD_CONFLICT: reload before changing files';
  end if;
  if not exists(select 1 from public.patients where clinic_id=p_clinic and id=p_patient and kind='object') then
    raise exception using errcode='22023',message='INVALID_PATIENT';
  end if;
  if p_operation='append' then
    if jsonb_typeof(p_data->'file') is distinct from 'object'
      or jsonb_typeof(p_data->'file'->'data') is distinct from 'string'
      or octet_length((p_data->'file')::text)>2200000 then
      raise exception using errcode='22023',message='INVALID_FILE: expected file of at most 2.2 MB encoded';
    end if;
    if private.table_level(p_clinic,'patient_files','arquivos',true)<2 then
      raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED';
    end if;
    row_id:=p_data->>'row_id';
    if exists(select 1 from public.patient_files where clinic_id=p_clinic and id=row_id) then
      raise exception using errcode='23505',message='DUPLICATE_FILE';
    end if;
    select id into marker from public.patient_files where clinic_id=p_clinic and parent_id=p_patient
      and slot='arquivos' and position=-1;
    if marker is null then marker:=p_data->>'marker_id';
    elsif not exists(select 1 from public.patient_files where clinic_id=p_clinic and id=marker and kind='array') then
      raise exception using errcode='22023',message='INVALID_FILE_COLLECTION';
    end if;
    changes:=jsonb_build_array(jsonb_build_object('table','patient_files','id',marker,'row',
      jsonb_build_object('parent_id',p_patient,'slot','arquivos','position',-1,'kind','array','dados',null)));
    select coalesce(max(position),-1)+1 into next_position from public.patient_files
      where clinic_id=p_clinic and parent_id=p_patient and slot='arquivos';
    changes:=changes||jsonb_build_array(jsonb_build_object('table','patient_files','id',row_id,'row',
      jsonb_build_object('parent_id',p_patient,'slot','arquivos','position',next_position,'kind','object','dados',p_data->'file')));
  elsif p_operation='delete' then
    select * into item from public.patient_files where clinic_id=p_clinic and id=p_data->>'row_id'
      and parent_id=p_patient and slot='arquivos' and position>=0;
    if not found then raise exception using errcode='22023',message='FILE_NOT_FOUND'; end if;
    changes:=jsonb_build_array(jsonb_build_object('table','patient_files','id',item.id,'delete',true));
  elsif p_operation='signature' then
    if p_data->>'slot' not in ('sign','evolSign') or p_data->>'slot' is null then
      raise exception using errcode='22023',message='INVALID_SIGNATURE_SLOT';
    end if;
    for slot_name,value in select key,contents from jsonb_each(p_data->'values') as fields(key,contents) loop
      if not slot_name=any(case when p_data->>'slot'='sign' then array['sign','signDate','signTermo']
        else array['evolSign','evolSignDate'] end) or jsonb_typeof(value)<>'string' or octet_length(value::text)>2200000 then
        raise exception using errcode='22023',message='INVALID_SIGNATURE';
      end if;
      select id into row_id from public.patient_files where clinic_id=p_clinic and parent_id=p_patient and slot=slot_name;
      if row_id is null then row_id:=p_data->'ids'->>slot_name; end if;
      changes:=changes||jsonb_build_array(jsonb_build_object('table','patient_files','id',row_id,'row',
        jsonb_build_object('parent_id',p_patient,'slot',slot_name,'position',-1,'kind','value','dados',value)));
    end loop;
    if jsonb_array_length(changes)<>(case when p_data->>'slot'='sign' then 3 else 2 end) then
      raise exception using errcode='22023',message='INCOMPLETE_SIGNATURE';
    end if;
  else raise exception using errcode='22023',message='INVALID_FILE_OPERATION';
  end if;
  return public.clinic_apply(p_clinic,p_revision,changes);
end $$;

revoke all on function private.read_revision(uuid,bigint),private.read_row(uuid,text,jsonb,boolean),
  private.read_page(uuid,bigint,text,text,text) from public,anon,authenticated;
revoke all on function public.clinic_load_start(uuid),public.clinic_load_page(uuid,bigint,text,text),
  public.clinic_files_page(uuid,bigint,text,text),public.clinic_row_chunk(uuid,bigint,text,text,integer),
  public.clinic_file_apply(uuid,bigint,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.clinic_load_start(uuid),public.clinic_load_page(uuid,bigint,text,text),
  public.clinic_files_page(uuid,bigint,text,text),public.clinic_row_chunk(uuid,bigint,text,text,integer),
  public.clinic_file_apply(uuid,bigint,text,text,jsonb) to authenticated;

notify pgrst,'reload schema';
commit;