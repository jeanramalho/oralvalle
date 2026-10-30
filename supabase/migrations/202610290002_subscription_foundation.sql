-- Nexodent: etapa 2, base de assinaturas e acompanhamento administrativo.
-- Não cria contas, não bloqueia clínicas e não modifica dados clínicos.
begin;
create table if not exists public.nexodent_clinic_subscriptions (
 clinic_id uuid primary key references public.clinics(id) on delete cascade,
 status text not null default 'trial' check (status in ('trial','active','past_due','canceled','expired','exempt')),
 trial_started_at timestamptz,
 trial_ends_at timestamptz,
 current_period_ends_at timestamptz,
 updated_at timestamptz not null default now(),
 check (trial_ends_at is null or trial_started_at is null or trial_ends_at > trial_started_at)
);
revoke all on public.nexodent_clinic_subscriptions from public,anon,authenticated;
alter table public.nexodent_clinic_subscriptions enable row level security;
-- Leitura de status limitada ao administrador da própria clínica (sem escrita pelo navegador).
create policy nexodent_subscription_clinic_admin_read on public.nexodent_clinic_subscriptions
for select to authenticated using (exists (
 select 1 from public.clinic_members m
 where m.clinic_id = nexodent_clinic_subscriptions.clinic_id
 and m.user_id = (select auth.uid()) and m.admin and m.active
));
grant select on public.nexodent_clinic_subscriptions to authenticated;
-- O painel de plataforma usa função com verificação de administrador no servidor.
create or replace function public.nexodent_admin_overview()
returns jsonb language plpgsql security definer set search_path = pg_catalog
as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists (
   select 1 from public.nexodent_platform_admins where user_id = auth.uid()
 ) then
   raise exception 'Acesso administrativo não autorizado' using errcode = '42501';
 end if;
 select jsonb_build_object(
  'total_clinicas',(select count(*) from public.clinics),
  'total_vinculos',(select count(*) from public.clinic_members),
  'em_teste',(select count(*) from public.nexodent_clinic_subscriptions where status='trial' and trial_ends_at > now()),
  'assinaturas_ativas',(select count(*) from public.nexodent_clinic_subscriptions where status='active'),
  'clinicas',coalesce((select jsonb_agg(jsonb_build_object(
    'id',c.id,'nome',c.nome,'created_at',c.created_at,
    'status_assinatura',s.status,'vencimento',case when s.status='trial' then s.trial_ends_at else s.current_period_ends_at end
  ) order by c.created_at desc)
  from public.clinics c left join public.nexodent_clinic_subscriptions s on s.clinic_id=c.id),'[]'::jsonb)
 ) into result;
 return result;
end;
$$;
revoke all on function public.nexodent_admin_overview() from public,anon;
grant execute on function public.nexodent_admin_overview() to authenticated;
commit;
