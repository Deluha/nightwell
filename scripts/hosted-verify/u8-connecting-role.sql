-- Context for every other result: what kind of role ran these queries?
-- Returns attributes only; the role's name is reported only if it is a platform role.
select
  case
    when r.rolname in (
      'anon', 'authenticated', 'service_role', 'authenticator', 'postgres', 'dashboard_user', 'pgbouncer',
      'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'supabase_realtime_admin',
      'supabase_replication_admin', 'supabase_read_only_user', 'supabase_etl_admin',
      'supabase_privileged_role', 'supabase_functions_admin'
    ) then r.rolname
    else 'other'
  end as platform_role,
  r.rolsuper as superuser,
  r.rolbypassrls as bypasses_row_security,
  pg_catalog.current_setting('transaction_read_only') as transaction_read_only,
  pg_catalog.current_setting('default_transaction_read_only') as default_transaction_read_only
from pg_catalog.pg_roles r
where r.rolname = current_user
