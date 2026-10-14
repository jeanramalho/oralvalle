-- Run once in the Supabase SQL editor, as postgres. No public bootstrap or self-join.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now()
);
create table public.clinic_members (
  clinic_id uuid not null references public.clinics(id),
  user_id uuid not null references auth.users(id),
  nome text not null default '', login text not null default '',
  admin boolean not null default false,
  perms jsonb default '{"ag":"view","pac":"view","lem":"view"}'::jsonb,
  active boolean not null default true,
  primary key (clinic_id, user_id),
  check (perms is null or jsonb_typeof(perms) = 'object')
);
create index clinic_members_user_id_idx on public.clinic_members(user_id);

-- Catalog is private, fixed by this migration, never supplied by a caller.
create table private.entity_catalog (
  table_name text primary key, parent_table text, slots text[] not null, rule text not null
);
insert into private.entity_catalog values
 ('patients',null,array['p'],'patients'),
 ('appointments',null,array['ag'],'appointments'),
 ('dentists',null,array['dt'],'dt'),
 ('procedures',null,array['pr'],'pr'),
 ('materials',null,array['mt'],'mt'),
 ('sales',null,array['vd'],'sales'),
 ('commission_payments',null,array['cp'],'cm'),
 ('reminders',null,array['lem'],'lem'),
 ('patient_anamneses','patients',array['anam'],'pac.anam'),
 ('patient_conditions','patient_anamneses',array['c'],'pac.anam'),
 ('patient_odontograms','patients',array['odo'],'pac.odo'),
 ('odontogram_history','patients',array['olog'],'pac.odo'),
 ('patient_evolutions','patients',array['evol'],'pac.odo'),
 ('dental_plans','patients',array['dplan'],'pac.odo'),
 ('budgets','patients',array['orcs'],'budgets'),
 ('budget_items','budgets',array['itens'],'budgets'),
 ('treatments','patients',array['trat'],'pac.trat'),
 ('treatment_materials','treatments',array['mats'],'pac.trat'),
 ('procedure_materials','procedures',array['mats'],'pr'),
 ('receipts','sales',array['pg'],'sales'),
 ('installments','sales',array['plano'],'sales'),
 ('patient_files','patients',array['arquivos','sign','signDate','signTermo','evolSign','evolSignDate'],'files'),
 ('document_models',null,array['rxm'],'models'),
 ('clinic_settings',null,array[]::text[],'settings');

-- A marker row represents an explicitly present array/map, including an empty one.
-- Entity rows keep scalar attributes in dados; child collections live in their own tables.
-- IDs are TEXT, scoped deterministic encodings, with the original legacy ID untouched in dados.
do $$
declare e record;
begin
  for e in select * from private.entity_catalog loop
    execute format('create table public.%I (
      clinic_id uuid not null references public.clinics(id),
      id text not null check (length(id) between 1 and 8192),
      parent_id text, slot text not null, position integer not null check (position >= -1),
      kind text not null check (kind in (''array'',''map'',''entry'',''object'',''value'')),
      dados jsonb not null,
      legacy_id text generated always as (dados ->> ''id'') stored,
      nome text generated always as (dados ->> ''nome'') stored,
      status text generated always as (coalesce(dados ->> ''status'', dados ->> ''st'')) stored,
      amount text generated always as (coalesce(dados ->> ''valor'', dados ->> ''preco'')) stored,
      primary key (clinic_id,id),
      unique nulls not distinct (clinic_id,parent_id,slot,position) deferrable initially deferred,
      check (kind <> ''object'' or jsonb_typeof(dados) = ''object''),
      check (kind not in (''array'',''map'') or (position = -1 and dados = ''null''::jsonb)),
      check (kind <> ''entry'' or (jsonb_typeof(dados) = ''object'' and dados ? ''key'' and dados ? ''value''))
    )', e.table_name);
    execute format('create index on public.%I (clinic_id,parent_id,slot,position)',e.table_name);
    execute format('create index on public.%I (clinic_id,legacy_id)',e.table_name);
  end loop;
  for e in select * from private.entity_catalog where parent_table is not null loop
    execute format('alter table public.%I add foreign key (clinic_id,parent_id)
      references public.%I(clinic_id,id) deferrable initially deferred', e.table_name,e.parent_table);
  end loop;
end $$;

-- Nullable, tenant-aware historical links. RPC resolves only existing object rows;
-- a deleted/missing historical catalog reference stays in dados, not an invalid FK.
create table private.reference_catalog (table_name text, column_name text, target_table text, legacy_key text,
  primary key(table_name,column_name));
insert into private.reference_catalog values
 ('appointments','patient_ref','patients','pid'), ('appointments','dentist_ref','dentists','dt'),
 ('appointments','sale_ref','sales','vid'),
 ('sales','patient_ref','patients','pid'), ('sales','dentist_ref','dentists','dt'),
 ('commission_payments','dentist_ref','dentists','dt'),
 ('budget_items','dentist_ref','dentists','dt'), ('budget_items','sale_ref','sales','vid'),
 ('budget_items','treatment_ref','treatments','tid'),
 ('treatments','dentist_ref','dentists','dt'), ('treatments','sale_ref','sales','vid'),
 ('treatments','budget_ref','budgets','oid'), ('treatments','budget_item_ref','budget_items','oiid'),
 ('patient_evolutions','sale_ref','sales','vid'), ('patient_evolutions','treatment_ref','treatments','tid'),
 ('patient_evolutions','appointment_ref','appointments','ag'),
 ('treatment_materials','material_ref','materials','mid'), ('procedure_materials','material_ref','materials','mid'),
 ('installments','receipt_ref','receipts','pgid');
do $$ declare r record; begin
  for r in select * from private.reference_catalog loop
    execute format('alter table public.%I add column %I text, add foreign key (clinic_id,%I)
      references public.%I(clinic_id,id) on delete set null (%I) deferrable initially deferred',
      r.table_name,r.column_name,r.column_name,r.target_table,r.column_name);
  end loop;
end $$;

create function private.level(p_clinic uuid, p_key text) returns integer
language plpgsql stable security definer set search_path = pg_catalog as $$
declare m public.clinic_members%rowtype; v text;
begin
  select * into m from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active;
  if not found then return 0; end if;
  if m.admin or m.perms is null then return 2; end if;
  v := m.perms ->> p_key;
  if v is null then return case when strpos(p_key,'.')>0 then 2 else 0 end; end if;
  return case v when 'edit' then 2 when 'view' then 1 else 0 end;
end $$;
create function private.is_admin(p_clinic uuid) returns boolean
language sql stable security definer set search_path = pg_catalog as $$
  select exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active and admin)
$$;
create function private.require_member(p_clinic uuid) returns void
language plpgsql stable security definer set search_path = pg_catalog as $$
begin
  if auth.uid() is null or not exists(select 1 from public.clinic_members
    where clinic_id=p_clinic and user_id=auth.uid() and active) then
    raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: active clinic membership required';
  end if;
end $$;
create function private.table_level(p_clinic uuid,p_table text,p_slot text,p_write boolean default false) returns integer
language plpgsql stable security definer set search_path = pg_catalog as $$
declare rule text; k text;
begin
  if not exists(select 1 from public.clinic_members where clinic_id=p_clinic and user_id=auth.uid() and active) then return 0; end if;
  select e.rule into rule from private.entity_catalog e where e.table_name=p_table;
  if rule is null then return 0; end if;
  if private.is_admin(p_clinic) then return 2; end if;
  if rule='patients' then
    if p_write then return least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.dados')); end if;
    return greatest(private.level(p_clinic,'pac'),private.level(p_clinic,'ag'),private.level(p_clinic,'pf'),private.level(p_clinic,'vd'));
  elsif rule='budgets' then
    return greatest(least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.orc')),private.level(p_clinic,'pf'));
  elsif rule='sales' then
    return greatest(private.level(p_clinic,'vd'),least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.pag')));
  elsif rule='appointments' then
    return greatest(private.level(p_clinic,'ag'),least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.agd')));
  elsif rule='files' then
    k := case when p_slot in ('sign','signDate','signTermo') then 'pac.anam'
      when p_slot in ('evolSign','evolSignDate') then 'pac.odo' else 'pac.arquivos' end;
    return least(private.level(p_clinic,'pac'),private.level(p_clinic,k));
  elsif rule='settings' then
    if p_slot='hc' then return private.level(p_clinic,'hc'); end if;
    if p_slot='meta' then return private.level(p_clinic,'bk'); end if;
    if p_write then return 0; end if; -- cl, avs and unknown settings: administrator writes only
    return case when p_slot in ('cl','avs') then 1 else 0 end;
  elsif rule='models' then
    return least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.arquivos'));
  elsif strpos(rule,'pac.')=1 then
    return least(private.level(p_clinic,'pac'),private.level(p_clinic,rule));
  end if;
  return private.level(p_clinic,rule);
end $$;

-- RLS is defense in depth; clients have NO direct table access (including SELECT).
alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
create policy clinic_member_read on public.clinics for select to authenticated
  using (exists(select 1 from public.clinic_members m where m.clinic_id=id and m.user_id=auth.uid() and m.active));
create policy member_read on public.clinic_members for select to authenticated
  using (user_id=auth.uid() or private.is_admin(clinic_id));
do $$ declare e record; begin
  for e in select * from private.entity_catalog loop
    execute format('alter table public.%I enable row level security',e.table_name);
    execute format('create policy module_read on public.%I for select to authenticated
      using (private.table_level(clinic_id,%L,slot,false)>=1)',e.table_name,e.table_name);
    execute format('revoke all on public.%I from public,anon,authenticated',e.table_name);
  end loop;
end $$;
revoke all on public.clinics,public.clinic_members from public,anon,authenticated;

create function public.clinic_list() returns jsonb
language sql stable security definer set search_path = pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object('clinic_id',c.id,'nome',c.nome,'user_id',m.user_id,
    'member_nome',m.nome,'login',(select u.email from auth.users u where u.id=m.user_id),'admin',m.admin,'perms',m.perms,'active',m.active) order by c.nome,c.id),'[]'::jsonb)
  from public.clinics c join public.clinic_members m on m.clinic_id=c.id
  where m.user_id=auth.uid() and m.active
$$;
create function public.clinic_members_list(p_clinic uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare result jsonb;
begin
  perform private.require_member(p_clinic);
  select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'user_id',user_id,'nome',nome,'login',(select u.email from auth.users u where u.id=user_id),
    'admin',admin,'perms',perms,'active',active) order by nome,user_id),'[]'::jsonb) into result
  from public.clinic_members where clinic_id=p_clinic and (private.is_admin(p_clinic) or user_id=auth.uid());
  return result;
end $$;

create function public.clinic_load(p_clinic uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare e record; list jsonb; result jsonb := '{}'::jsonb; access jsonb := '{}'::jsonb; rev bigint; readable boolean; slots_access jsonb;
begin
  perform private.require_member(p_clinic);
  -- Same clinic lock as writes: all nested tables and revision are one coherent read.
  select revision into rev from public.clinics where id=p_clinic for share;
  perform private.require_member(p_clinic);
  for e in select * from private.entity_catalog order by table_name loop
    select exists(select 1 from unnest(case when cardinality(e.slots)=0 then array['cl','hc','meta','avs'] else e.slots end) s
      where private.table_level(p_clinic,e.table_name,s,false)>=1) into readable;
    execute format('select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''parent_id'',parent_id,''slot'',slot,
      ''position'',position,''kind'',kind,''dados'',dados) order by parent_id,slot,position,id),''[]''::jsonb)
      from public.%I where clinic_id=$1 and private.table_level($1,%L,slot,false)>=1',e.table_name,e.table_name)
      into list using p_clinic;
    if e.table_name='patients' and least(private.level(p_clinic,'pac'),private.level(p_clinic,'pac.dados'))<1 then
      select coalesce(jsonb_agg(case when r->>'kind'='object' then jsonb_set(r,'{dados}',
        (r->'dados') - array(select jsonb_object_keys(r->'dados') except select unnest(array['id','nome']))) else r end),'[]'::jsonb)
        into list from jsonb_array_elements(list) r;
    end if;
    result := result || jsonb_build_object(e.table_name,list);
    select coalesce(jsonb_object_agg(s, private.table_level(p_clinic,e.table_name,s,true)>=2),'{}'::jsonb)
      into slots_access from unnest(case when cardinality(e.slots)=0 then array['cl','hc','meta','avs'] else e.slots end) s;
    access := access || jsonb_build_object(e.table_name,jsonb_build_object('read',readable,
      'admin',private.is_admin(p_clinic),'write',slots_access));
  end loop;
  return jsonb_build_object('revision',rev::text,'tables',result,'access',access);
end $$;

create function public.clinic_apply(p_clinic uuid,p_revision bigint,p_changes jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare rev bigint; change jsonb; row_data jsonb; old_row jsonb; e private.entity_catalog%rowtype;
  r record; scope_sql text; seen text[] := array[]::text[]; token text; slot_name text; deleting boolean;
begin
  perform private.require_member(p_clinic);
  if jsonb_typeof(p_changes) is distinct from 'array' or jsonb_array_length(p_changes)>50000 then
    raise exception using errcode='22023',message='INVALID_CHANGES: expected at most 50000 changes';
  end if;
  select revision into rev from public.clinics where id=p_clinic for update;
  perform private.require_member(p_clinic);
  if p_revision is null or rev<>p_revision then
    raise exception using errcode='40001',message='CLOUD_CONFLICT: clinic revision changed; reload before saving';
  end if;
  if jsonb_array_length(p_changes)=0 then return jsonb_build_object('revision',rev::text); end if;
  -- Validate every path BEFORE applying anything, including existing row permissions.
  for change in select value from jsonb_array_elements(p_changes) loop
    select * into e from private.entity_catalog where table_name=change->>'table';
    if not found or jsonb_typeof(change) <> 'object' or jsonb_typeof(change->'id') is distinct from 'string'
      or length(change->>'id') not between 1 and 8192
      or exists(select 1 from jsonb_object_keys(change) k where k not in ('table','id','row','delete')) then
      raise exception using errcode='22023',message='INVALID_CHANGES: table/id/keys';
    end if;
    token := e.table_name || ':' || (change->>'id');
    if token=any(seen) then raise exception using errcode='22023',message='INVALID_CHANGES: duplicate row'; end if;
    seen := array_append(seen,token);
    deleting := coalesce(change->'delete'='true'::jsonb,false);
    if change ? 'delete' and change->'delete'<>'true'::jsonb then
      raise exception using errcode='22023',message='INVALID_CHANGES: delete must be true';
    end if;
    execute format('select to_jsonb(t) from public.%I t where clinic_id=$1 and id=$2',e.table_name)
      into old_row using p_clinic,change->>'id';
    if old_row is not null and private.table_level(p_clinic,e.table_name,old_row->>'slot',true)<2 then
      raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: existing row is not editable';
    end if;
    if deleting then
      if old_row is null or change ? 'row' then raise exception using errcode='22023',message='INVALID_CHANGES: invalid deletion'; end if;
      -- A patient contains independently protected records. Partial users cannot delete its shell.
      if e.table_name='patients' and not private.is_admin(p_clinic) then
        raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: patient deletion requires administrator';
      end if;
      continue;
    end if;
    row_data := change->'row'; slot_name := row_data->>'slot';
    if jsonb_typeof(row_data) is distinct from 'object'
      or not (row_data ?& array['parent_id','slot','position','kind','dados'])
      or exists(select 1 from jsonb_object_keys(row_data) k where k not in ('parent_id','slot','position','kind','dados'))
      or jsonb_typeof(row_data->'slot') is distinct from 'string'
      or (cardinality(e.slots)>0 and not slot_name=any(e.slots))
      or (e.table_name='clinic_settings' and slot_name in ('p','ag','dt','pr','mt','vd','cp','lem','rxm'))
      or jsonb_typeof(row_data->'position') is distinct from 'number'
      or (row_data->>'position') !~ '^-?[0-9]+$'
      or row_data->>'kind' not in ('array','map','entry','object','value')
      or (e.parent_table is null and row_data->'parent_id'<>'null'::jsonb)
      or (e.parent_table is not null and jsonb_typeof(row_data->'parent_id') is distinct from 'string') then
      raise exception using errcode='22023',message='INVALID_CHANGES: malformed relational row';
    end if;
    if private.table_level(p_clinic,e.table_name,slot_name,true)<2 then
      raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: module/slot is not editable';
    end if;
    if old_row is not null and (old_row->'parent_id'<>row_data->'parent_id' or old_row->>'slot'<>slot_name) then
      raise exception using errcode='22023',message='INVALID_CHANGES: row parent and slot are immutable';
    end if;
    if old_row is not null and old_row->'dados'->'id' is distinct from row_data->'dados'->'id' then
      raise exception using errcode='22023',message='INVALID_CHANGES: legacy identity is immutable';
    end if;
    -- Patient roots cannot hide an unfiltered snapshot in a malformed value row.
    if e.table_name='patients' and not (
      (row_data->>'kind'='array' and (row_data->>'position')::integer=-1 and row_data->'dados'='null'::jsonb)
      or (row_data->>'kind'='object' and (row_data->>'position')::integer>=0)) then
      raise exception using errcode='22023',message='INVALID_CHANGES: patients must be object rows in an array';
    end if;
    if e.table_name='patients' and row_data->>'kind'='object' and
      (coalesce(jsonb_typeof(row_data->'dados'->'id'),'null') not in ('string','number') or not (row_data->'dados' ? 'id')) then
      raise exception using errcode='22023',message='INVALID_CHANGES: patient legacy id required';
    end if;
    -- Do not allow sensitive subdocuments to be smuggled into patient core or other parents.
    if jsonb_typeof(row_data->'dados')='object' and (
      (e.table_name='patients' and row_data->'dados' ?| array['anam','odo','olog','evol','dplan','orcs','trat','arquivos','sign','signDate','signTermo','evolSign','evolSignDate'])
      or (e.table_name='patient_anamneses' and row_data->'dados' ? 'c')
      or (e.table_name='budgets' and row_data->'dados' ? 'itens')
      or (e.table_name in ('treatments','procedures') and row_data->'dados' ? 'mats')
      or (e.table_name='sales' and row_data->'dados' ?| array['pg','plano'])) then
      raise exception using errcode='22023',message='INVALID_CHANGES: nested collection must use its relational table';
    end if;
  end loop;
  -- Inserts/upserts first; deferred tenant FKs allow a whole dependency graph in one transaction.
  for change in select value from jsonb_array_elements(p_changes) where not coalesce(value->'delete'='true'::jsonb,false) loop
    row_data := change->'row';
    execute format('insert into public.%I(clinic_id,id,parent_id,slot,position,kind,dados)
      values($1,$2,$3,$4,$5,$6,$7) on conflict(clinic_id,id) do update set
      position=excluded.position,kind=excluded.kind,dados=excluded.dados',change->>'table')
      using p_clinic,change->>'id',row_data->>'parent_id',row_data->>'slot',
        (row_data->>'position')::integer,row_data->>'kind',row_data->'dados';
  end loop;
  for change in select value from jsonb_array_elements(p_changes) where value->'delete'='true'::jsonb loop
    execute format('delete from public.%I where clinic_id=$1 and id=$2',change->>'table') using p_clinic,change->>'id';
  end loop;
  -- Resolve links after inserts AND deletes. Repair references clinic-wide without touching dados.
  -- This deliberately uses SET NULL for removed historical targets, never cascades hidden data.
  for r in select * from private.reference_catalog loop
    scope_sql := '';
    if r.target_table in ('treatments','budgets','budget_items') then
      scope_sql := case when r.target_table='budget_items' then
        ' and (select b.parent_id from public.budgets b where b.clinic_id=dst.clinic_id and b.id=dst.parent_id)'
        else ' and dst.parent_id' end || '=' || case when r.table_name='budget_items' then
        '(select b.parent_id from public.budgets b where b.clinic_id=src.clinic_id and b.id=src.parent_id)'
        else 'src.parent_id' end;
    elsif r.target_table='receipts' then scope_sql := ' and dst.parent_id=src.parent_id';
    end if;
    execute format('update public.%I src set %I=(select min(dst.id) from public.%I dst
      where dst.clinic_id=src.clinic_id and dst.kind=''object'' and dst.legacy_id=src.dados->>%L
      %s having count(*)=1) where src.clinic_id=$1',r.table_name,r.column_name,r.target_table,r.legacy_key,scope_sql)
      using p_clinic;
  end loop;
  if jsonb_array_length(p_changes)>0 then
    update public.clinics set revision=revision+1 where id=p_clinic returning revision into rev;
  end if;
  return jsonb_build_object('revision',rev::text);
end $$;

create function public.clinic_update_member(p_clinic uuid,p_user_id uuid,p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare m public.clinic_members%rowtype; v jsonb; k text;
begin
  perform private.require_member(p_clinic);
  perform 1 from public.clinics where id=p_clinic for update;
  if not private.is_admin(p_clinic) then raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: administrator required'; end if;
  if p_user_id=auth.uid() then raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: self membership changes require SQL administrator'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_patch) x where x not in ('perms','active')) then
    raise exception using errcode='22023',message='INVALID_MEMBER_PATCH: only perms/active allowed';
  end if;
  if p_patch ? 'active' and jsonb_typeof(p_patch->'active') is distinct from 'boolean' then
    raise exception using errcode='22023',message='INVALID_MEMBER_PATCH: active must be boolean';
  end if;
  if p_patch ? 'perms' then
    if jsonb_typeof(p_patch->'perms') is distinct from 'object' then raise exception using errcode='22023',message='INVALID_MEMBER_PATCH: perms must be object'; end if;
    for k,v in select key,value from jsonb_each(p_patch->'perms') loop
      if k not in ('ag','pac','lem','dt','cm','vd','pf','hc','pr','mt','bk','pac.dados','pac.anam','pac.odo','pac.orc','pac.trat','pac.pag','pac.agd','pac.arquivos')
        or v not in ('"none"'::jsonb,'"view"'::jsonb,'"edit"'::jsonb) then
        raise exception using errcode='22023',message='INVALID_MEMBER_PATCH: invalid permission';
      end if;
    end loop;
  end if;
  select * into m from public.clinic_members where clinic_id=p_clinic and user_id=p_user_id for update;
  if not found then raise exception using errcode='P0002',message='MEMBER_NOT_FOUND'; end if;
  if m.admin and p_patch->'active'='false'::jsonb and
    not exists(select 1 from public.clinic_members where clinic_id=p_clinic and active and admin and user_id<>p_user_id) then
    raise exception using errcode='42501',message='LAST_ADMIN: cannot disable last active administrator';
  end if;
  update public.clinic_members set
    perms=case when p_patch ? 'perms' then p_patch->'perms' else perms end,
    active=case when p_patch ? 'active' then (p_patch->>'active')::boolean else active end
    where clinic_id=p_clinic and user_id=p_user_id;
  update public.clinics set revision=revision+1 where id=p_clinic;
  return public.clinic_members_list(p_clinic);
end $$;

-- PostgreSQL grants EXECUTE to PUBLIC by default: explicitly close every function.
revoke all on private.entity_catalog,private.reference_catalog from public,anon,authenticated;
revoke all on function private.level(uuid,text),private.is_admin(uuid),private.require_member(uuid),
  private.table_level(uuid,text,text,boolean) from public,anon,authenticated;
revoke all on function public.clinic_list(),public.clinic_load(uuid),public.clinic_apply(uuid,bigint,jsonb),
  public.clinic_members_list(uuid),public.clinic_update_member(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.clinic_list(),public.clinic_load(uuid),public.clinic_apply(uuid,bigint,jsonb),
  public.clinic_members_list(uuid),public.clinic_update_member(uuid,uuid,jsonb) to authenticated;
commit;