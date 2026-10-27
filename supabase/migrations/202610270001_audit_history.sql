-- Execute no SQL Editor como administrador, depois das migrations anteriores.
-- Histórico de mudanças das tabelas clínicas. Acesso direto bloqueado.
begin;
create table if not exists private.clinic_audit_log (
  audit_id bigint generated always as identity primary key,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_id uuid,
  clinic_id uuid not null,
  entity_table text not null,
  entity_id text not null,
  operation text not null check (operation in ('INSERT','UPDATE','DELETE')),
  previous_data jsonb,
  current_data jsonb
);
create index if not exists clinic_audit_log_clinic_time on private.clinic_audit_log(clinic_id,occurred_at desc);
revoke all on private.clinic_audit_log from public,anon,authenticated;
create or replace function private.log_clinic_change() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if tg_op='UPDATE' and old.dados is not distinct from new.dados then return new; end if;
  if tg_op='DELETE' then
    insert into private.clinic_audit_log(actor_id,clinic_id,entity_table,entity_id,operation,previous_data)
    values(auth.uid(),old.clinic_id,tg_table_name,old.id,tg_op,old.dados);
    return old;
  elsif tg_op='INSERT' then
    insert into private.clinic_audit_log(actor_id,clinic_id,entity_table,entity_id,operation,current_data)
    values(auth.uid(),new.clinic_id,tg_table_name,new.id,tg_op,new.dados);
  else
    insert into private.clinic_audit_log(actor_id,clinic_id,entity_table,entity_id,operation,previous_data,current_data)
    values(auth.uid(),new.clinic_id,tg_table_name,new.id,tg_op,old.dados,new.dados);
  end if;
  return new;
end $$;
do $$ declare t record; begin
 for t in select table_name from private.entity_catalog loop
  execute format('drop trigger if exists audit_changes on public.%I',t.table_name);
  execute format('create trigger audit_changes after insert or update or delete on public.%I for each row execute function private.log_clinic_change()',t.table_name);
 end loop;
end $$;
commit;
