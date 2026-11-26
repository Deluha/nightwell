-- U8 (hosted half): which platform roles does a hosted project have?
-- Returns the names of roles that match the platform's reserved names and prefixes, with their
-- attributes; every other role is counted, never named.
select
  case
    when r.rolname ~ '^(supabase_|pg_|pgsodium_)'
      or r.rolname in ('anon', 'authenticated', 'service_role', 'authenticator', 'postgres', 'dashboard_user', 'pgbouncer')
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
