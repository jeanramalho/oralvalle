-- Nexodent Admin: primeira etapa, somente leitura. Não altera dados clínicos.
begin;
create table if not exists public.nexodent_platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on public.nexodent_platform_admins from public, anon, authenticated;
alter table public.nexodent_platform_admins enable row level security;

create or replace function public.nexodent_admin_overview()
returns jsonb language plpgsql security definer
set search_path = pg_catalog
as $$
declare result jsonb;
begin
  if auth.uid() is null or not exists (
    select 1 from public.nexodent_platform_admins where user_id = auth.uid()
  ) then
    raise exception 'Acesso administrativo não autorizado' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'total_clinicas', (select count(*) from public.clinics),
    'total_vinculos', (select count(*) from public.clinic_members),
    'clinicas', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'created_at', c.created_at)
      order by c.created_at desc) from public.clinics c
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.nexodent_admin_overview() from public, anon;
grant execute on function public.nexodent_admin_overview() to authenticated;
commit;
-- Habilite um administrador MANUALMENTE no SQL Editor, substituindo pelo UUID verificado:
-- insert into public.nexodent_platform_admins(user_id) values ('UUID-DO-PROPRIETARIO');
