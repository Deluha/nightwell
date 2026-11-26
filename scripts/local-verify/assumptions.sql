-- Checks assumptions U2 to U5 of ROADMAP.md, and the general half of U1, on a stock PostgreSQL. It creates
-- scratch objects, so it runs only against a throwaway local container:
--   docker exec -i <container> psql -U postgres -X -q -At -v ON_ERROR_STOP=1 -f - < assumptions.sql
-- Never run it against a database that holds anything. Each line of output is
-- "<assumption> <statement> = true|false".
\set QUIET on
set client_min_messages = warning;
drop schema if exists nw cascade;
drop role if exists nw_owner, nw_plain, nw_bypass, nw_named;
create role nw_owner; create role nw_plain; create role nw_bypass bypassrls; create role nw_named;
create schema nw;
create extension if not exists dblink;

create function nw.helper() returns int language sql stable as 'select 1';
create table nw.t (id int default nw.helper(), x int);
alter table nw.t enable row level security;
create policy p on nw.t to nw_named using (x = nw.helper());
create view nw.v as select nw.helper() as h;
create view nw.v_string as select 'nw.helper()'::text as h;
create function nw.f_atomic() returns int language sql begin atomic select nw.helper(); end;
create function nw.f_string() returns int language sql as 'select nw.helper()';
create function nw.f_plpgsql() returns int language plpgsql as 'begin return nw.helper(); end';
create function nw.f_outer() returns int language sql begin atomic select nw.f_atomic(); end;

-- U2: what the catalog records as a dependency on nw.helper().
with helper as (select 'nw.helper()'::regprocedure::oid as oid),
recorded(what, found) as (
  select 'a policy expression is recorded', exists (
    select 1 from pg_depend d, helper h, pg_policy p
    where d.refobjid = h.oid and d.classid = 'pg_policy'::regclass and d.objid = p.oid and p.polname = 'p')
  union all select 'a column default is recorded', exists (
    select 1 from pg_depend d, helper h
    where d.refobjid = h.oid and d.classid = 'pg_attrdef'::regclass)
  union all select 'a view is recorded', exists (
    select 1 from pg_depend d, helper h, pg_rewrite r
    where d.refobjid = h.oid and d.classid = 'pg_rewrite'::regclass and d.objid = r.oid
      and r.ev_class = 'nw.v'::regclass)
  union all select 'a BEGIN ATOMIC function is recorded', exists (
    select 1 from pg_depend d, helper h
    where d.refobjid = h.oid and d.classid = 'pg_proc'::regclass and d.objid = 'nw.f_atomic()'::regprocedure)
  union all select 'a string-bodied SQL function is not recorded', not exists (
    select 1 from pg_depend d, helper h
    where d.refobjid = h.oid and d.objid = 'nw.f_string()'::regprocedure)
  union all select 'a PL/pgSQL function is not recorded', not exists (
    select 1 from pg_depend d, helper h
    where d.refobjid = h.oid and d.objid = 'nw.f_plpgsql()'::regprocedure)
  union all select 'a string constant is not recorded', not exists (
    select 1 from pg_depend d, helper h, pg_rewrite r
    where d.refobjid = h.oid and d.objid = r.oid and r.ev_class = 'nw.v_string'::regclass)
  union all select 'dependencies are not transitive', not exists (
    select 1 from pg_depend d, helper h
    where d.refobjid = h.oid and d.objid = 'nw.f_outer()'::regprocedure)
  union all select 'a policy role is not in pg_depend', not exists (
    select 1 from pg_depend d where d.refobjid = 'nw_named'::regrole)
  union all select 'a policy role is in pg_shdepend', exists (
    select 1 from pg_shdepend d where d.refobjid = 'nw_named'::regrole and d.classid = 'pg_policy'::regclass)
)
select 'U2 ' || what || ' = ' || found from recorded;

-- U3: side effects that a read-only transaction still allows.
create function nw.attempt(statement text) returns boolean language plpgsql as $$
begin
  execute statement;
  return true;
exception when others then
  return false;
end $$;
create temp table nw_tmp (x int);
create view nw.v_table as select x from nw.t;
create index t_x on nw.t (x);
create function nw.locked(name text) returns boolean language sql as $$
  select exists (
    select 1 from pg_locks l
    where l.locktype = 'relation' and l.relation = to_regclass(name) and l.pid = pg_backend_pid())
$$;
begin transaction read only;
select 'U3 pg_notify is allowed = ' || nw.attempt($$select pg_notify('nw', 'x')$$);
select 'U3 an advisory lock is allowed = ' || nw.attempt('select pg_advisory_xact_lock(42)');
select 'U3 set_config is allowed = ' || nw.attempt($$select set_config('nw.x', '1', false)$$);
select 'U3 creating a temp table is allowed = ' || nw.attempt('create temp table nw_new (x int)');
select 'U3 a write to an existing temp table is allowed = '
  || nw.attempt('insert into nw_tmp values (1)');
select 'U3 a write through dblink is allowed = ' || nw.attempt(
  $$select dblink_exec('dbname=' || current_database(), 'create table nw.via_dblink (x int)')$$);
select 'U3 a write to an ordinary table is refused = '
  || not nw.attempt('insert into nw.t (x) values (1)');
select 'U3 no lock is held before deparsing = '
  || not (nw.locked('nw.v_table') or nw.locked('nw.t') or nw.locked('nw.t_x'));
select pg_get_viewdef(c.oid) is not null from pg_class c where c.oid = to_regclass('nw.v_table');
select 'U3 pg_get_viewdef leaves a lock on the view = ' || nw.locked('nw.v_table');
select 'U3 pg_get_viewdef leaves a lock on the underlying table = ' || nw.locked('nw.t');
select pg_get_indexdef(c.oid) is not null from pg_class c where c.oid = to_regclass('nw.t_x');
select 'U3 pg_get_indexdef leaves a lock on the index = ' || nw.locked('nw.t_x');
rollback;
select 'U3 the dblink write survived the rollback = ' || (to_regclass('nw.via_dblink') is not null);

-- U4: deparsed expressions and the search path.
set search_path = nw, public;
select 'U4 the qualifier is omitted when the schema is on search_path = '
  || (pg_get_expr(polqual, polrelid) not like '%nw.helper%') from pg_policy where polname = 'p';
set search_path = pg_catalog;
select 'U4 the qualifier is kept under search_path = pg_catalog = '
  || (pg_catalog.pg_get_expr(polqual, polrelid) like '%nw.helper%')
  from pg_catalog.pg_policy where polname = 'p';
reset search_path;

-- U5: who is not subject to policies.
create table nw.rls (x int);
alter table nw.rls owner to nw_owner;
insert into nw.rls values (1), (2);
alter table nw.rls enable row level security;
create policy nothing on nw.rls using (false);
grant usage on schema nw to nw_owner, nw_plain, nw_bypass;
grant select on nw.rls to nw_plain, nw_bypass;
select 'U5 a superuser is not subject to policies = ' || ((select count(*) from nw.rls) = 2);
set role nw_owner;
select 'U5 the table owner is not subject to policies = ' || ((select count(*) from nw.rls) = 2);
set role nw_bypass;
select 'U5 a BYPASSRLS role is not subject to policies = ' || ((select count(*) from nw.rls) = 2);
set role nw_plain;
select 'U5 an ordinary role is subject to policies = ' || ((select count(*) from nw.rls) = 0);
select 'U1 information_schema lists only what the caller has privileges on = ' || (
  (select count(*) from information_schema.tables where table_schema = 'nw') = 1
  and (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'nw' and c.relkind = 'r') > 1);
reset role;
alter table nw.rls force row level security;
set role nw_owner;
select 'U5 the owner is subject to policies under FORCE = ' || ((select count(*) from nw.rls) = 0);
reset role;

drop schema nw cascade;
drop role nw_owner, nw_plain, nw_bypass, nw_named;
