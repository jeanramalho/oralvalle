-- Apply as postgres after 001. Auth owns accounts, passwords and email confirmation.
begin;
create table if not exists private.main_clinic (
  singleton boolean primary key default true check (singleton),
  clinic_id uuid not null unique references public.clinics(id),
  admin_email text not null default 'oralvalle.odontologia@gmail.com'
    check (admin_email = 'oralvalle.odontologia@gmail.com')
);
create table if not exists private.clinic_access_requests (
  clinic_id uuid not null references private.main_clinic(clinic_id),
  user_id uuid not null references auth.users(id),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_by uuid references auth.users(id), decided_at timestamptz,
  primary key (clinic_id,user_id),
  check ((status='pending' and decided_by is null and decided_at is null)
    or (status<>'pending' and decided_by is not null and decided_at is not null))
);
alter table private.main_clinic enable row level security;
alter table private.clinic_access_requests enable row level security;
revoke all on schema private from public,anon,authenticated;
revoke all on private.main_clinic,private.clinic_access_requests from public,anon,authenticated;

do $$
declare c uuid; matches bigint;
begin
  -- Serialize bootstrap without selecting an arbitrary clinic or overwriting its data.
  lock table public.clinics in share row exclusive mode;
  lock table private.main_clinic in exclusive mode;
  select clinic_id into c from private.main_clinic where singleton;
  if not found then
    select count(*) into matches from public.clinics where lower(btrim(nome))='oral valle';
    if matches>1 then
      raise exception 'MAIN_CLINIC_AMBIGUOUS: multiple Oral Valle clinics; have the SQL administrator identify the primary clinic and rename non-primary duplicate clinics without deleting data, then rerun this migration';
    elsif matches=1 then
      select id into c from public.clinics where lower(btrim(nome))='oral valle';
    else
      insert into public.clinics(nome) values ('Oral Valle') returning id into c;
    end if;
    insert into private.main_clinic(clinic_id) values (c);
  end if;
  perform 1 from public.clinics where id=c for update;
  if not exists(select 1 from public.clinic_settings where clinic_id=c and slot='cl') then
    insert into public.clinic_settings(clinic_id,id,parent_id,slot,position,kind,dados)
      values (c,'[null,"cl"]',null,'cl',0,'value',
        '{"marca":"Oral Valle","nome":"Oral Valle","sub":"Clínica Odontológica","email":"oralvalle.odontologia@gmail.com"}'::jsonb);
    update public.clinics set revision=revision+1 where id=c;
  end if;
end $$;

-- Auth row first, clinic second: the trigger, backfill and approval share lock order.
create or replace function private.sync_main_clinic_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = pg_catalog as $$
declare u auth.users%rowtype; m public.clinic_members%rowtype;
  main private.main_clinic%rowtype; verified boolean; changed integer;
begin
  select * into u from auth.users where id=p_user_id for update;
  if not found then return; end if;
  select * into main from private.main_clinic where singleton;
  if not found then raise exception 'MAIN_CLINIC_NOT_CONFIGURED'; end if;
  perform 1 from public.clinics where id=main.clinic_id for update;
  verified := u.email_confirmed_at is not null and u.deleted_at is null
    and not coalesce(u.is_anonymous,false);
  select * into m from public.clinic_members
    where clinic_id=main.clinic_id and user_id=u.id for update;
  -- An email change away from the reserved address disables the old bootstrap profile.
  if lower(u.email)=main.admin_email or lower(m.login)=main.admin_email then
    if verified and lower(u.email)=main.admin_email then
      insert into public.clinic_members as existing(clinic_id,user_id,nome,login,admin,perms,active)
        values (main.clinic_id,u.id,'Ricardo Silva',u.email,true,null,true)
        on conflict (clinic_id,user_id) do update set
          nome=excluded.nome,login=excluded.login,admin=true,perms=null,active=true
        where (existing.nome,existing.login,existing.admin,existing.perms,existing.active)
          is distinct from (excluded.nome,excluded.login,true,null::jsonb,true);
    else
      -- Do not create membership for an unconfirmed principal; disable any old grant.
      update public.clinic_members set admin=false,active=false
        where clinic_id=main.clinic_id and user_id=u.id and (admin or active);
    end if;
    get diagnostics changed = row_count;
    if changed>0 then
      update public.clinics set revision=revision+1 where id=main.clinic_id;
    end if;
    -- The principal never appears in the approval queue, including preexisting requests.
    delete from private.clinic_access_requests where clinic_id=main.clinic_id and user_id=u.id;
    return;
  end if;
  if not verified or u.email is null or btrim(u.email)='' then return; end if;
  if exists(select 1 from public.clinic_members where clinic_id=main.clinic_id and user_id=u.id) then
    return; -- Inactive/revoked members are not requeued or reactivated.
  end if;
  insert into private.clinic_access_requests(clinic_id,user_id) values (main.clinic_id,u.id)
    on conflict (clinic_id,user_id) do nothing; -- Rejected requests stay rejected.
end $$;

create or replace function private.main_clinic_auth_trigger() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  perform private.sync_main_clinic_user(new.id);
  return new;
end $$;
revoke all on function private.sync_main_clinic_user(uuid),private.main_clinic_auth_trigger()
  from public,anon,authenticated;
drop trigger if exists oralvalle_main_clinic_access on auth.users;
create trigger oralvalle_main_clinic_access
  after insert or update of email,email_confirmed_at,deleted_at,is_anonymous on auth.users
  for each row execute function private.main_clinic_auth_trigger();

do $$
declare u auth.users%rowtype;
begin
  for u in select * from auth.users order by id loop
    perform private.sync_main_clinic_user(u.id);
  end loop;
end $$;

create or replace function public.clinic_pending_users(p_clinic uuid) returns jsonb
language plpgsql stable security definer set search_path = pg_catalog as $$
declare result jsonb; main private.main_clinic%rowtype;
begin
  perform private.require_member(p_clinic);
  select * into main from private.main_clinic where singleton;
  if p_clinic is distinct from main.clinic_id or not private.is_admin(p_clinic)
    or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null
      and deleted_at is null and not coalesce(is_anonymous,false)) then
    raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: verified main clinic administrator required';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',u.id,
    'nome',coalesce(u.raw_user_meta_data->>'nome',''),'email',u.email,'created_at',r.created_at)
    order by r.created_at,u.id),'[]'::jsonb) into result
    from private.clinic_access_requests r join auth.users u on u.id=r.user_id
    where r.clinic_id=p_clinic and r.status='pending' and u.email_confirmed_at is not null
      and u.deleted_at is null and not coalesce(u.is_anonymous,false)
      and u.email is not null and btrim(u.email)<>'' and lower(u.email)<>main.admin_email
      and not exists(select 1 from public.clinic_members m where m.clinic_id=p_clinic and m.user_id=u.id);
  return result; -- Metadata is display text only, never an authorization input.
end $$;

create or replace function public.clinic_decide_user(p_clinic uuid,p_user_id uuid,p_approve boolean) returns jsonb
language plpgsql security definer set search_path = pg_catalog as $$
declare u auth.users%rowtype; caller auth.users%rowtype;
  main private.main_clinic%rowtype; request private.clinic_access_requests%rowtype;
begin
  perform private.require_member(p_clinic);
  select * into main from private.main_clinic where singleton;
  if p_clinic is distinct from main.clinic_id or not private.is_admin(p_clinic) then
    raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: main clinic administrator required';
  end if;
  if p_approve is null or p_user_id is null or p_user_id=auth.uid() then
    raise exception using errcode='22023',message='INVALID_ACCESS_DECISION: explicit decision and another user required';
  end if;
  -- Lock both Auth records in deterministic order before the shared clinic lock.
  perform 1 from auth.users where id in (auth.uid(),p_user_id) order by id for update;
  select * into caller from auth.users where id=auth.uid();
  if caller.id is null or caller.email_confirmed_at is null or caller.deleted_at is not null
    or coalesce(caller.is_anonymous,false) then
    raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: verified nonanonymous administrator required';
  end if;
  perform 1 from public.clinics where id=p_clinic for update;
  perform private.require_member(p_clinic);
  if not private.is_admin(p_clinic) then
    raise exception using errcode='42501',message='CLOUD_PERMISSION_DENIED: administrator required';
  end if;
  select * into u from auth.users where id=p_user_id;
  if not found or u.email_confirmed_at is null or u.deleted_at is not null
    or coalesce(u.is_anonymous,false) or u.email is null or btrim(u.email)=''
    or lower(u.email)=main.admin_email then
    raise exception using errcode='22023',message='INVALID_ACCESS_DECISION: target must be verified, nonanonymous and not the reserved principal';
  end if;
  select * into request from private.clinic_access_requests
    where clinic_id=p_clinic and user_id=p_user_id for update;
  if not found or request.status<>'pending' then
    raise exception using errcode='22023',message='INVALID_ACCESS_DECISION: pending request required; already decided requests cannot be replayed';
  end if;
  perform 1 from public.clinic_members where clinic_id=p_clinic and user_id=p_user_id for update;
  if found then
    raise exception using errcode='22023',message='INVALID_ACCESS_DECISION: membership already exists; queue cannot change roles or reactivate users';
  end if;
  if p_approve then
    insert into public.clinic_members(clinic_id,user_id,nome,login,admin,perms,active)
      values (p_clinic,p_user_id,coalesce(u.raw_user_meta_data->>'nome',''),u.email,false,
        '{"ag":"view","pac":"view","lem":"view","dt":"none","cm":"none","vd":"none","pf":"none","hc":"none","pr":"none","mt":"none","bk":"none","pac.dados":"none","pac.anam":"none","pac.odo":"none","pac.orc":"none","pac.trat":"none","pac.pag":"none","pac.agd":"none","pac.arquivos":"none"}'::jsonb,true);
    update public.clinics set revision=revision+1 where id=p_clinic;
  end if;
  update private.clinic_access_requests set status=case when p_approve then 'approved' else 'rejected' end,
    decided_by=auth.uid(),decided_at=now() where clinic_id=p_clinic and user_id=p_user_id;
  return public.clinic_members_list(p_clinic);
end $$;

revoke all on function public.clinic_pending_users(uuid),public.clinic_decide_user(uuid,uuid,boolean)
  from public,anon,authenticated;
grant execute on function public.clinic_pending_users(uuid),public.clinic_decide_user(uuid,uuid,boolean)
  to authenticated;
notify pgrst, 'reload schema';
commit;