begin;

-- Busca somente o prontuário do paciente aberto, incluindo estruturas aninhadas.
-- Não modifica dados e respeita revisão e permissões por tabela/campo.
create function public.clinic_patient_details(
  p_clinic uuid,
  p_revision bigint,
  p_patient text
) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
  rev bigint;
  item record;
  tbl text;
  nested_ids text[] := ARRAY[]::text[];
  rows_by_table jsonb := '{}'::jsonb;
  current_rows jsonb;
  encoded jsonb;
  allowed boolean;
begin
  if p_patient is null or p_revision is null then
    raise exception using errcode='22023', message='PATIENT_AND_REVISION_REQUIRED';
  end if;
  rev := private.read_revision(p_clinic, p_revision);

  if not exists (
    select 1 from public.patients p
    where p.clinic_id=p_clinic and p.id=p_patient and p.kind='object' and p.slot='p'
  ) then
    raise exception using errcode='22023', message='INVALID_PATIENT';
  end if;
  if private.table_level(p_clinic,'patients','p',false)<1 then
    raise exception using errcode='42501', message='PATIENT_READ_DENIED';
  end if;

  foreach tbl in array ARRAY[
    'patient_anamneses','patient_odontograms','odontogram_history',
    'patient_evolutions','dental_plans','budgets','treatments'
  ] loop
    current_rows := '[]'::jsonb;
    for item in execute format(
      'select id,parent_id,slot,position,kind,dados from public.%I where clinic_id=$1 and parent_id=$2 order by id', tbl
    ) using p_clinic,p_patient loop
      if private.table_level(p_clinic,tbl,item.slot,false)<1 then continue; end if;
      encoded := private.read_row(p_clinic,tbl,to_jsonb(item),false);
      current_rows := current_rows || jsonb_build_array(encoded);
      if item.kind='object' and tbl in ('patient_anamneses','budgets','treatments') then
        nested_ids := array_append(nested_ids,item.id);
      end if;
    end loop;
    rows_by_table := rows_by_table || jsonb_build_object(tbl,current_rows);
  end loop;

  foreach tbl in array ARRAY['patient_conditions','budget_items','treatment_materials'] loop
    current_rows := '[]'::jsonb;
    if cardinality(nested_ids)>0 then
      for item in execute format(
        'select id,parent_id,slot,position,kind,dados from public.%I where clinic_id=$1 and parent_id = any($2) order by id', tbl
      ) using p_clinic,nested_ids loop
        if private.table_level(p_clinic,tbl,item.slot,false)<1 then continue; end if;
        encoded := private.read_row(p_clinic,tbl,to_jsonb(item),false);
        current_rows := current_rows || jsonb_build_array(encoded);
      end loop;
    end if;
    rows_by_table := rows_by_table || jsonb_build_object(tbl,current_rows);
  end loop;

  -- O prontuário é individual: rejeita respostas que excedam um limite seguro.
  if octet_length(rows_by_table::text)>8000000 then
    raise exception using errcode='54000', message='PATIENT_DETAILS_TOO_LARGE';
  end if;
  return jsonb_build_object('revision',rev::text,'patient_id',p_patient,'tables',rows_by_table);
end $$;

revoke all on function public.clinic_patient_details(uuid,bigint,text) from public,anon,authenticated;
grant execute on function public.clinic_patient_details(uuid,bigint,text) to authenticated;
notify pgrst,'reload schema';
commit;
