begin;

-- Índices para as consultas mais comuns. Não alteram nem removem dados.
create index if not exists ov_patients_name_idx
  on public.patients (clinic_id, lower(coalesce(dados->>'nome','')), id)
  where kind = 'object' and slot = 'p';

create index if not exists ov_appointments_date_idx
  on public.appointments (clinic_id, (dados->>'data'), id)
  where kind = 'object' and slot = 'ag';

create index if not exists ov_sales_date_idx
  on public.sales (clinic_id, (dados->>'data'), id)
  where kind = 'object' and slot = 'vd';

create index if not exists ov_reminders_date_idx
  on public.reminders (clinic_id, (dados->>'data'), id)
  where kind = 'object' and slot = 'lem';

create index if not exists ov_child_parent_slot_idx
  on public.patient_evolutions (clinic_id, parent_id, slot, id);

-- API paginada para telas que precisam de busca/filtro no servidor.
-- Usa a mesma revisão e a mesma camada de permissões das leituras existentes.
create function public.clinic_query_page(
  p_clinic uuid,
  p_revision bigint,
  p_table text,
  p_after text default null,
  p_query text default null,
  p_from date default null,
  p_to date default null,
  p_parent text default null,
  p_limit integer default 50
) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
  rev bigint;
  item record;
  entity record;
  rows jsonb := '[]'::jsonb;
  encoded jsonb;
  cursor_id text := p_after;
  scanned integer := 0;
  emitted integer := 0;
  lim integer := least(greatest(coalesce(p_limit,50),1),100);
  more boolean := false;
  q text := nullif(trim(coalesce(p_query,'')), '');
  row_date date;
begin
  if p_revision is null then
    raise exception using errcode='22023', message='REVISION_REQUIRED';
  end if;
  rev := private.read_revision(p_clinic,p_revision);
  select * into entity from private.entity_catalog where table_name=p_table;
  if not found or p_table='patient_files' then
    raise exception using errcode='22023', message='INVALID_QUERY_TABLE';
  end if;
  if p_parent is not null and p_table in ('patients','appointments','dentists','procedures','materials','sales','commission_payments','reminders') then
    raise exception using errcode='22023', message='PARENT_FILTER_NOT_SUPPORTED';
  end if;

  for item in execute format(
    'select id,parent_id,slot,position,kind,dados from public.%I
     where clinic_id=$1 and ($2::text is null or id>$2)
       and ($3::text is null or parent_id=$3)
     order by id limit 2001', p_table)
    using p_clinic,p_after,p_parent
  loop
    scanned := scanned + 1;
    if scanned > 2000 then
      more := true;
      exit;
    end if;
    cursor_id := item.id;
    if item.kind <> 'object' then continue; end if;
    if private.table_level(p_clinic,p_table,item.slot,false)<1 then continue; end if;

    if q is not null and not (
      coalesce(item.dados->>'nome','') ilike '%'||q||'%' or
      coalesce(item.dados->>'cpf','') ilike '%'||q||'%' or
      coalesce(item.dados->>'tel','') ilike '%'||q||'%' or
      coalesce(item.dados->>'proc','') ilike '%'||q||'%' or
      coalesce(item.dados->>'titulo','') ilike '%'||q||'%'
    ) then continue; end if;

    if p_from is not null or p_to is not null then
      begin row_date := nullif(item.dados->>'data','')::date;
      exception when others then row_date := null;
      end;
      if p_from is not null and (row_date is null or row_date<p_from) then continue; end if;
      if p_to is not null and (row_date is null or row_date>p_to) then continue; end if;
    end if;

    encoded := private.read_row(p_clinic,p_table,to_jsonb(item),false);
    rows := rows || jsonb_build_array(encoded);
    emitted := emitted + 1;
    if emitted >= lim then
      more := true;
      exit;
    end if;
  end loop;

  return jsonb_build_object('revision',rev::text,'rows',rows,
    'next',case when more then cursor_id else null end);
end $$;

revoke all on function public.clinic_query_page(uuid,bigint,text,text,text,date,date,text,integer)
  from public,anon,authenticated;
grant execute on function public.clinic_query_page(uuid,bigint,text,text,text,date,date,text,integer)
  to authenticated;

notify pgrst,'reload schema';
commit;
