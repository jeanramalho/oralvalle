-- Etapa 3B: ativação por titular com email verificado após aprovação.
-- A clínica é criada somente no primeiro acesso confirmado do titular.
begin;
alter table public.nexodent_trial_requests add column if not exists activated_at timestamptz;
alter table public.nexodent_trial_requests add column if not exists activated_clinic_id uuid references public.clinics(id);
create unique index if not exists nexodent_trial_activated_clinic_unique on public.nexodent_trial_requests(activated_clinic_id) where activated_clinic_id is not null;
create or replace function public.nexodent_activate_approved_trial()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare u auth.users%rowtype; r public.nexodent_trial_requests%rowtype; new_clinic uuid; main_id uuid;
begin
 if auth.uid() is null then raise exception 'Faça login para ativar' using errcode='42501'; end if;
 select * into u from auth.users where id=auth.uid() for update;
 if not found or u.email_confirmed_at is null or u.deleted_at is not null or coalesce(u.is_anonymous,false) then
   raise exception 'Confirme seu email antes de ativar' using errcode='42501';
 end if;
 select clinic_id into main_id from private.main_clinic where singleton;
 if lower(u.email)=(select admin_email from private.main_clinic where singleton) then
   raise exception 'Conta principal reservada' using errcode='42501';
 end if;
 select * into r from public.nexodent_trial_requests
 where lower(email)=lower(u.email) and status='approved'
 order by reviewed_at asc nulls last,created_at asc limit 1 for update;
 if not found then raise exception 'Não existe solicitação aprovada para este email' using errcode='42501'; end if;
 if r.activated_clinic_id is not null then
   if exists(select 1 from public.clinic_members where clinic_id=r.activated_clinic_id and user_id=u.id and active) then
     return jsonb_build_object('ok',true,'clinic_id',r.activated_clinic_id,'already_activated',true);
   end if;
   raise exception 'Esta solicitação já foi utilizada' using errcode='42501';
 end if;
 if exists(select 1 from public.clinic_members where user_id=u.id and active) then
   raise exception 'Esta conta já possui acesso a uma clínica' using errcode='42501';
 end if;
 insert into public.clinics(nome) values(r.clinica) returning id into new_clinic;
 insert into public.clinic_members(clinic_id,user_id,nome,login,admin,perms,active)
 values(new_clinic,u.id,r.nome,u.email,true,null,true);
 insert into public.nexodent_clinic_subscriptions(clinic_id,status,trial_started_at,trial_ends_at)
 values(new_clinic,'trial',now(),now()+interval '15 days');
 update public.nexodent_trial_requests set activated_clinic_id=new_clinic,activated_at=now() where id=r.id;
 -- Evita que o usuário ativado permaneça na fila de adesão à OralValle.
 delete from private.clinic_access_requests where user_id=u.id and clinic_id=main_id and status='pending';
 return jsonb_build_object('ok',true,'clinic_id',new_clinic,'already_activated',false);
end;$$;
revoke all on function public.nexodent_activate_approved_trial() from public,anon;
grant execute on function public.nexodent_activate_approved_trial() to authenticated;
-- Não enfileirar futuros candidatos aprovados/pendentes na clínica OralValle.
-- Mantém a regra de proteção da clínica principal e sua administração.
create or replace function private.main_clinic_auth_trigger() returns trigger
language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.email is not null and exists (
   select 1 from public.nexodent_trial_requests r
   where lower(r.email)=lower(new.email) and r.status in ('pending','approved')
 ) then
   -- Mantém o processamento especial do proprietário da OralValle.
   if lower(new.email)<>(select admin_email from private.main_clinic where singleton) then
     return new;
   end if;
 end if;
 perform private.sync_main_clinic_user(new.id);
 return new;
end;$$;
notify pgrst,'reload schema';
commit;
