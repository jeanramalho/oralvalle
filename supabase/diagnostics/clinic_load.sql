begin read only;
set local statement_timeout = '10s';

select name,setting,unit,source
from pg_settings where name in ('statement_timeout','lock_timeout');

select rolname,setting
from pg_roles cross join lateral unnest(rolconfig) setting
where rolname in ('authenticator','authenticated','anon')
  and (setting like 'statement_timeout=%' or setting like 'lock_timeout=%');

select database_settings.setrole::regrole as role_name,
  database_settings.setdatabase,setting
from pg_db_role_setting database_settings
cross join lateral unnest(database_settings.setconfig) setting
where setting like 'statement_timeout=%' or setting like 'lock_timeout=%';

select functions.oid::regprocedure as function_name,functions.proowner::regrole as owner,
  functions.prosecdef,functions.proconfig,functions.proacl
from pg_proc functions
where functions.oid in ('public.clinic_load(uuid)'::regprocedure,
  'public.clinic_apply(uuid,bigint,jsonb)'::regprocedure);

select pg_get_functiondef('public.clinic_load(uuid)'::regprocedure) as previous_clinic_load;

select pid,usename,state,wait_event_type,wait_event,
  now()-query_start as elapsed,pg_blocking_pids(pid) as blocked_by
from pg_stat_activity
where datname=current_database() and pid<>pg_backend_pid()
  and state in ('active','idle in transaction');

select relname,n_live_tup,n_dead_tup,last_analyze,last_autoanalyze,
  pg_size_pretty(pg_total_relation_size(relid)) as total_relation_size
from pg_stat_user_tables
where schemaname='public'
order by pg_total_relation_size(relid) desc;

select clinic_id,slot,count(*) as rows,
  pg_size_pretty(sum(pg_column_size(dados))::bigint) as stored_json_size
from public.patient_files
group by clinic_id,slot
order by sum(pg_column_size(dados)) desc;

commit;