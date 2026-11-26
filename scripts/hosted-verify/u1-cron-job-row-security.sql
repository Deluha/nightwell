-- U1 (first half): is cron.job filtered by row-level security to the current user?
-- Reads the catalog entry and the platform's own policy on cron.job; never a row of cron.job.
-- Returns booleans and counts. No row means the relation is absent.
select
  c.relrowsecurity as row_security_enabled,
  c.relforcerowsecurity as row_security_forced,
  (select count(*) from pg_catalog.pg_policy p where p.polrelid = c.oid) as policy_count,
  (
    select coalesce(bool_or(pg_catalog.pg_get_expr(p.polqual, p.polrelid) ilike '%current_user%'), false)
    from pg_catalog.pg_policy p
    where p.polrelid = c.oid
  ) as a_policy_filters_on_current_user,
  pg_catalog.has_table_privilege(c.oid, 'select') as scanner_may_select
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'cron' and c.relname = 'job'
