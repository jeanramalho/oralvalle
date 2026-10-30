-- Etapa 3A: fila de solicitações. Aprovação NÃO cria acesso nem inicia teste.
begin;
create table if not exists public.nexodent_trial_requests (
 id uuid primary key default gen_random_uuid(),
 nome text not null check (char_length(nome) between 3 and 120),
 clinica text not null check (char_length(clinica) between 3 and 150),
 email text not null check (char_length(email) between 5 and 254),
 whatsapp text not null check (char_length(whatsapp) between 8 and 30),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id)
);
create unique index if not exists nexodent_trial_pending_email on public.nexodent_trial_requests (lower(email)) where status='pending';
alter table public.nexodent_trial_requests enable row level security;
revoke all on public.nexodent_trial_requests from public,anon,authenticated;
create or replace function public.nexodent_request_trial(p_nome text,p_clinica text,p_email text,p_whatsapp text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if char_length(trim(coalesce(p_nome,''))) not between 3 and 120
 or char_length(trim(coalesce(p_clinica,''))) not between 3 and 150
 or char_length(trim(coalesce(p_email,''))) not between 5 and 254
 or trim(coalesce(p_email,'')) !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or char_length(trim(coalesce(p_whatsapp,''))) not between 8 and 30 then
   raise exception 'Preencha todos os campos corretamente' using errcode='22023';
 end if;
 insert into public.nexodent_trial_requests(nome,clinica,email,whatsapp)
 values(trim(p_nome),trim(p_clinica),lower(trim(p_email)),trim(p_whatsapp));
 return jsonb_build_object('ok',true);
exception when unique_violation then
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function public.nexodent_request_trial(text,text,text,text) from public;
grant execute on function public.nexodent_request_trial(text,text,text,text) to anon,authenticated;
create or replace function public.nexodent_admin_trial_requests()
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
  raise exception 'Acesso não autorizado' using errcode='42501';
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'nome',r.nome,'clinica',r.clinica,'email',r.email,'whatsapp',r.whatsapp,'status',r.status,'created_at',r.created_at) order by r.created_at desc) from (select * from public.nexodent_trial_requests order by created_at desc limit 100) r),'[]'::jsonb);
end;$$;
revoke all on function public.nexodent_admin_trial_requests() from public,anon;
grant execute on function public.nexodent_admin_trial_requests() to authenticated;
create or replace function public.nexodent_admin_review_trial(p_id uuid,p_decision text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare changed int;
begin
 if auth.uid() is null or not exists(select 1 from public.nexodent_platform_admins where user_id=auth.uid()) then
  raise exception 'Acesso não autorizado' using errcode='42501';
 end if;
 if p_decision not in ('approved','rejected') then raise exception 'Decisão inválida'; end if;
 update public.nexodent_trial_requests set status=p_decision,reviewed_at=now(),reviewed_by=auth.uid()
 where id=p_id and status='pending';
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Solicitação não encontrada ou já analisada'; end if;
 return jsonb_build_object('ok',true,'status',p_decision,'access_granted',false);
end;$$;
revoke all on function public.nexodent_admin_review_trial(uuid,text) from public,anon;
grant execute on function public.nexodent_admin_review_trial(uuid,text) to authenticated;
commit;
