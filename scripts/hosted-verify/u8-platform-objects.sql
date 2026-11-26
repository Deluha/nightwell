-- U8 (hosted half): which platform schemas, extensions and webhook objects does a hosted project have?
-- Checks a fixed list of platform names for presence; every other extension is counted, never named.
select 'schema' as kind, name, exists (
    select 1 from pg_catalog.pg_namespace n where n.nspname = name
  ) as present
from pg_catalog.unnest(array[
  'auth', 'storage', 'realtime', 'vault', 'extensions', 'graphql', 'graphql_public',
  'supabase_functions', 'supabase_migrations', 'cron', 'net', 'pgmq', 'pgsodium', 'pgbouncer'
]) as name
union all
select 'extension', name, exists (
    select 1 from pg_catalog.pg_extension e where e.extname = name
  )
from pg_catalog.unnest(array[
  'pg_graphql', 'pg_net', 'supabase_vault', 'pg_jsonschema', 'wrappers', 'index_advisor',
  'pgsodium', 'pgjwt', 'pg_cron', 'pgmq', 'pgcrypto', 'uuid-ossp', 'pg_stat_statements'
]) as name
union all
select 'other-extensions', 'count:' || count(*)::text, true
from pg_catalog.pg_extension e
where e.extname not in (
  'plpgsql', 'pg_graphql', 'pg_net', 'supabase_vault', 'pg_jsonschema', 'wrappers', 'index_advisor',
  'pgsodium', 'pgjwt', 'pg_cron', 'pgmq', 'pgcrypto', 'uuid-ossp', 'pg_stat_statements'
)
union all
select 'function', 'supabase_functions.http_request', exists (
    select 1
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'supabase_functions' and p.proname = 'http_request'
  )
union all
select 'publication', 'supabase_realtime', exists (
    select 1 from pg_catalog.pg_publication p where p.pubname = 'supabase_realtime'
  )
union all
select 'server', 'version_num:' || pg_catalog.current_setting('server_version_num'), true
order by 1, 2
