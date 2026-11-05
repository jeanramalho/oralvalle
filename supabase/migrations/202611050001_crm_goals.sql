-- NexoDent CRM — Atualização 27: metas compartilhadas por clínica/mês.
-- Execute uma vez no SQL Editor do Supabase, antes de publicar o JavaScript.
create table if not exists public.nexodent_crm_goals (
 clinic_id uuid not null references public.clinics(id) on delete cascade,
 month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 target_amount numeric(14,2) not null check (target_amount > 0),
 updated_at timestamptz not null default now(),
 primary key (clinic_id, month)
);
alter table public.nexodent_crm_goals enable row level security;
revoke all on public.nexodent_crm_goals from anon, authenticated;
grant select on public.nexodent_crm_goals to authenticated;
drop policy if exists nexodent_crm_goals_read on public.nexodent_crm_goals;
create policy nexodent_crm_goals_read on public.nexodent_crm_goals for select to authenticated
using (exists(select 1 from public.clinic_members m where m.clinic_id=clinic_id and m.user_id=(select auth.uid()) and m.active is true));

create or replace function public.nexodent_crm_goal_can_edit(p_clinic_id uuid)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
 select exists(select 1 from public.clinic_members m where m.clinic_id=p_clinic_id and m.user_id=auth.uid() and m.active is true and m.admin is true);
$$;
revoke all on function public.nexodent_crm_goal_can_edit(uuid) from public, anon;
grant execute on function public.nexodent_crm_goal_can_edit(uuid) to authenticated;

create or replace function public.nexodent_crm_goal_save(p_clinic_id uuid,p_month text,p_target numeric)
returns void language plpgsql security definer set search_path = pg_catalog as $$
begin
 if auth.uid() is null or not public.nexodent_crm_goal_can_edit(p_clinic_id) then
  raise exception 'Apenas administradores ativos podem alterar metas' using errcode='42501';
 end if;
 if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or p_target is null or p_target<=0 or p_target>999999999999.99 then
  raise exception 'Meta ou mês inválido' using errcode='22023';
 end if;
 insert into public.nexodent_crm_goals(clinic_id,month,target_amount,updated_at)
 values(p_clinic_id,p_month,p_target,now())
 on conflict(clinic_id,month) do update set target_amount=excluded.target_amount,updated_at=now();
end;
$$;
revoke all on function public.nexodent_crm_goal_save(uuid,text,numeric) from public, anon;
grant execute on function public.nexodent_crm_goal_save(uuid,text,numeric) to authenticated;
