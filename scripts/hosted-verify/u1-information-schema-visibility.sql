-- U1 (second half): does information_schema show only objects the caller has privileges on?
-- Compares, per Supabase-managed schema, the tables in the catalog with those visible through
-- information_schema.tables to the connecting role. Returns platform schema names and counts.
select
  n.nspname as managed_schema,
  count(*) as tables_in_catalog,
  count(*) filter (where pg_catalog.has_table_privilege(c.oid, 'select')) as tables_scanner_may_select,
  (
    select count(*)
    from information_schema.tables t
    where t.table_schema = n.nspname and t.table_type = 'BASE TABLE'
  ) as tables_in_information_schema
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname in ('auth', 'storage', 'realtime', 'vault', 'cron', 'net', 'supabase_functions', 'pgsodium')
group by n.nspname
order by n.nspname
