-- U8 (hosted half): which platform roles does a hosted project have?
-- Returns the names of roles on a fixed list of platform roles and of PostgreSQL's own pg_ roles,
-- with their attributes; every other role is counted, never named.
select
  case
    when r.rolname like 'pg\_%' or r.rolname in (
      'anon', 'authenticated', 'service_role', 'authenticator', 'postgres', 'dashboard_user', 'pgbouncer',
      'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'supabase_realtime_admin',
      'supabase_replication_admin', 'supabase_read_only_user', 'supabase_etl_admin',
      'supabase_privileged_role', 'supabase_functions_admin'
    )
      then r.rolname
    else 'other'
  end as platform_role,
  count(*) as roles,
  bool_or(r.rolsuper) as superuser,
  bool_or(r.rolbypassrls) as bypasses_row_security,
  bool_or(r.rolcanlogin) as can_log_in
from pg_catalog.pg_roles r
group by 1
order by 1
