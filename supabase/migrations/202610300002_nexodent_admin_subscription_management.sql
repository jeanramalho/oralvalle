-- Nexo Admin 168: gerenciamento de assinaturas. Executar uma vez no SQL Editor.
-- Não modifica dados clínicos, nem bloqueia automaticamente o acesso do NexoDent.
begin;
alter table public.nexodent_clinic_subscriptions add column if not exists grace_days integer not null default 0;
alter table public.nexodent_clinic_subscriptions drop constraint if exists nexodent_subscriptions_grace_days_check;
alter table public.nexodent_clinic_subscriptions add constraint nexodent_subscriptions_grace_days_check check (grace_days between 0 and 365);
create table if not exists public.nexodent_subscription_audit (
 id bigint generated always as identity primary key,
 clinic_id uuid not null references public.clinics(id),
 actor_id uuid not null references auth.users(id),
 action text not null,
 reason text not null,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default now()
);
alter table public.nexodent_subscription_audit enable row level security;
revoke all on public.nexodent_subscription_audit from public,anon,authenticated;
create or replace function public.nexodent_admin_manage_subscription(
 p_clinic uuid,p_action text,p_days integer default null,p_until date default null,p_reason text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare old_row public.nexodent_clinic_subscriptions%rowtype;
 new_row public.nexodent_clinic_subscriptions%rowtype;
 base_date timestamptz;
begin
 if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
  raise exception 'Acesso administrativo não autorizado' using errcode='42501';
 end if;
 if length(trim(coalesce(p_reason,'')))<5 or length(p_reason)>500 then
  raise exception 'Justificativa obrigatória (5 a 500 caracteres)' using errcode='22023';
 end if;
 if p_action not in ('extend','set_date','permanent','grace','suspend','reactivate') then
  raise exception 'Ação inválida' using errcode='22023';
 end if;
 perform 1 from public.clinics where id=p_clinic for update;
 if not found then raise exception 'Clínica inexistente' using errcode='22023'; end if;
 insert into public.nexodent_clinic_subscriptions(clinic_id,status)
 values(p_clinic,'trial') on conflict (clinic_id) do nothing;
 select * into old_row from public.nexodent_clinic_subscriptions where clinic_id=p_clinic for update;
 if p_action='extend' then
  if p_days is null or p_days not between 1 and 3650 then raise exception 'Prazo inválido'; end if;
  base_date:=greatest(now(),coalesce(case when old_row.status='trial' then old_row.trial_ends_at else old_row.current_period_ends_at end,now()));
  update public.nexodent_clinic_subscriptions set status='active',current_period_ends_at=base_date+make_interval(days=>p_days),updated_at=now() where clinic_id=p_clinic;
 elsif p_action='set_date' then
  if p_until is null or p_until<current_date or p_until>current_date+3650 then raise exception 'Data inválida'; end if;
  update public.nexodent_clinic_subscriptions set status='active',current_period_ends_at=(p_until+1)::timestamp at time zone 'UTC',updated_at=now() where clinic_id=p_clinic;
 elsif p_action='permanent' then
  update public.nexodent_clinic_subscriptions set status='exempt',current_period_ends_at=null,updated_at=now() where clinic_id=p_clinic;
 elsif p_action='grace' then
  if p_days is null or p_days not between 0 and 365 then raise exception 'Tolerância inválida'; end if;
  update public.nexodent_clinic_subscriptions set grace_days=p_days,updated_at=now() where clinic_id=p_clinic;
 elsif p_action='suspend' then
  update public.nexodent_clinic_subscriptions set status='canceled',updated_at=now() where clinic_id=p_clinic;
 elsif p_action='reactivate' then
  update public.nexodent_clinic_subscriptions set status='active',current_period_ends_at=greatest(now()+interval '1 day',coalesce(current_period_ends_at,now())),updated_at=now() where clinic_id=p_clinic;
 end if;
 select * into new_row from public.nexodent_clinic_subscriptions where clinic_id=p_clinic;
 insert into public.nexodent_subscription_audit(clinic_id,actor_id,action,reason,before_data,after_data)
 values(p_clinic,auth.uid(),p_action,trim(p_reason),to_jsonb(old_row),to_jsonb(new_row));
 return jsonb_build_object('ok',true,'status',new_row.status,'vencimento',new_row.current_period_ends_at,'grace_days',new_row.grace_days);
end;$$;
revoke all on function public.nexodent_admin_manage_subscription(uuid,text,integer,date,text) from public,anon;
grant execute on function public.nexodent_admin_manage_subscription(uuid,text,integer,date,text) to authenticated;
create or replace function public.nexodent_admin_subscription_history()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
  raise exception 'Acesso administrativo não autorizado' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('clinic_id',a.clinic_id,'clinic_name',c.nome,'actor_id',a.actor_id,'action',a.action,'reason',a.reason,'created_at',a.created_at) order by a.created_at desc)
 from (select * from public.nexodent_subscription_audit order by created_at desc limit 100) a
 join public.clinics c on c.id=a.clinic_id),'[]'::jsonb);
end;$$;
revoke all on function public.nexodent_admin_subscription_history() from public,anon;
grant execute on function public.nexodent_admin_subscription_history() to authenticated;
create or replace function public.nexodent_admin_overview()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
  raise exception 'Acesso administrativo não autorizado' using errcode='42501';
 end if;
 return jsonb_build_object(
 'total_clinicas',(select count(*) from public.clinics),
 'total_vinculos',(select count(*) from public.clinic_members),
 'em_teste',(select count(*) from public.nexodent_clinic_subscriptions where status='trial' and trial_ends_at>now()),
 'assinaturas_ativas',(select count(*) from public.nexodent_clinic_subscriptions where status='active'),
 'clinicas',coalesce((select jsonb_agg(jsonb_build_object(
 'id',c.id,'nome',c.nome,'created_at',c.created_at,'status_assinatura',s.status,
 'grace_days',coalesce(s.grace_days,0),
 'vencimento',case when s.status='trial' then s.trial_ends_at else s.current_period_ends_at end
 ) order by c.created_at desc)
 from public.clinics c left join public.nexodent_clinic_subscriptions s on s.clinic_id=c.id),'[]'::jsonb));
end;$$;
revoke all on function public.nexodent_admin_overview() from public,anon;
grant execute on function public.nexodent_admin_overview() to authenticated;
notify pgrst,'reload schema';
commit;
