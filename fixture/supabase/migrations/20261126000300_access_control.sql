-- Cellarbook access control: row level security, policies, grants, default privileges, a view, a
-- materialized view and functions that call the auth helpers. Synthetic demo for Nightwell.
--
-- Adapted from: https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/database/postgres/row-level-security.mdx
-- (policy, view and security-definer shapes), .../api/securing-your-api.mdx (grants, default privileges) and
-- .../database/functions.mdx (function privileges). Licence of supabase/supabase: Apache-2.0 (LICENSE read 2026-11-26).
--
-- Sources used below (all read 2026-11-26):
--   RLS  = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/database/postgres/row-level-security.mdx
--   API  = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/api/securing-your-api.mdx
--   FUNC = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/database/functions.mdx
--   RBAC = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/api/custom-claims-and-role-based-access-control-rbac.mdx
--   HELP = https://github.com/supabase/auth/blob/0725a1d90cd9fbbb2a26f3baf18afd400a436f66/migrations/20220224000811_update_auth_functions.up.sql
--          and .../migrations/20220531120530_add_auth_jwt_function.up.sql (helper bodies; supabase/auth is MIT)

-- planted: db.cellars-is-public-column (control) — plain column added with alter table; used by the anon policy
alter table public.cellars add column is_public boolean not null default false;

-- planted: db.rls-enabled (tie) — row level security on every public table
-- source: RLS#enable-rls-and-set-the-grants (read 2026-11-26)
alter table public.cellars enable row level security;
alter table public.members enable row level security;
alter table public.profiles enable row level security;
alter table public.bottles enable row level security;
alter table public.tasting_notes enable row level security;

-- planted: db.default-privileges-tables (tie) — default privileges naming a built-in role
-- source: API#default-privileges (read 2026-11-26)
alter default privileges in schema public grant select on tables to authenticated;
-- planted: db.default-privileges-functions (tie) — default privileges for functions naming a built-in role
-- source: FUNC (function privileges section) (read 2026-11-26)
alter default privileges in schema public grant execute on functions to authenticated;

-- planted: db.grants-built-in-roles (tie) — explicit grants naming anon, authenticated and service_role
-- source: API#grant-access-explicitly (read 2026-11-26)
revoke all on table public.cellars, public.members, public.profiles, public.bottles, public.tasting_notes
  from anon, authenticated;
grant select on table public.cellars to anon;
grant select, insert, update, delete on table public.cellars, public.members, public.bottles, public.tasting_notes
  to authenticated;
grant select, update on table public.profiles to authenticated;
grant all on table public.cellars, public.members, public.profiles, public.bottles, public.tasting_notes
  to service_role;
-- identity sequences are needed for inserts through the API
grant usage on all sequences in schema public to authenticated, service_role;

-- planted: db.private-schema-definer-helper (tie) — security-definer function in an unexposed schema; reaches auth.uid() only through it
-- source: RLS#use-security-definer-functions (read 2026-11-26)
create schema app_private;
grant usage on schema app_private to authenticated;

create function app_private.is_cellar_member(cellar uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.members m
    where m.cellar_id = cellar and m.user_id = (select auth.uid())
  )
$$;

revoke execute on function app_private.is_cellar_member(uuid) from public;
revoke execute on function app_private.is_cellar_member(uuid) from anon;
grant execute on function app_private.is_cellar_member(uuid) to authenticated;

-- planted: db.policy-uid-bare (tie) — policy calls auth.uid() directly, not wrapped in a select
-- source: RLS (auth.uid() section) (read 2026-11-26); helper body: HELP (read 2026-11-26)
create policy "members_select_own" on public.members
  for select to authenticated
  using (user_id = auth.uid());

-- planted: db.policy-request-setting (tie) — policy reads the request setting directly, with no helper
-- source: HELP (the helpers read request.jwt.claims; setting name verified there) (read 2026-11-26)
create policy "members_select_own_setting" on public.members
  for select to authenticated
  using (user_id::text = nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub');

-- planted: db.policy-uid-select-wrapped (tie) — the (select auth.uid()) form
-- source: RLS (policy examples) (read 2026-11-26)
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- planted: db.policy-via-definer-function (tie) — policies reach auth.uid() only through app_private.is_cellar_member
-- source: RLS#use-security-definer-functions (read 2026-11-26)
create policy "cellars_select_member" on public.cellars
  for select to authenticated
  using ((select app_private.is_cellar_member(id)));

create policy "bottles_select_member" on public.bottles
  for select to authenticated
  using ((select app_private.is_cellar_member(cellar_id)));

create policy "bottles_update_member" on public.bottles
  for update to authenticated
  using ((select app_private.is_cellar_member(cellar_id)))
  with check ((select app_private.is_cellar_member(cellar_id)));

create policy "tasting_notes_select_member" on public.tasting_notes
  for select to authenticated
  using (exists (
    select 1 from public.bottles b
    where b.id = bottle_id and (select app_private.is_cellar_member(b.cellar_id))
  ));

-- planted: db.policy-jwt-claim (tie) — policy reads an app_metadata claim through auth.jwt()
-- source: RLS (auth.jwt() section) (read 2026-11-26); RBAC for custom claims (read 2026-11-26)
create policy "cellars_admin_all" on public.cellars
  for all to authenticated
  using (((select auth.jwt()) -> 'app_metadata' ->> 'cellar_admin')::boolean)
  with check (((select auth.jwt()) -> 'app_metadata' ->> 'cellar_admin')::boolean);

-- planted: db.policy-auth-role (tie) — policy calls auth.role(); the helper is marked deprecated in the auth migration
-- source: HELP (comment on function role(): "Deprecated. Use auth.jwt() -> 'role' instead.") (read 2026-11-26)
-- The current docs read 2026-11-26 do not show auth.role().
create policy "bottles_insert_member" on public.bottles
  for insert to authenticated
  with check (auth.role() = 'authenticated' and (select app_private.is_cellar_member(cellar_id)));

-- planted: db.policy-auth-email (tie) — policy calls auth.email(); the helper is marked deprecated in the auth migration
-- source: HELP (comment on function email(): "Deprecated. Use auth.jwt() -> 'email' instead.") (read 2026-11-26)
-- The current docs read 2026-11-26 do not show auth.email().
create policy "tasting_notes_insert_author" on public.tasting_notes
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and auth.email() is not null
    and exists (
      select 1 from public.bottles b
      where b.id = bottle_id and (select app_private.is_cellar_member(b.cellar_id))
    )
  );

-- planted: db.policy-to-anon (tie) — policy naming the anon role
-- source: RLS (policy examples with `to`) (read 2026-11-26)
create policy "cellars_select_public" on public.cellars
  for select to anon
  using (is_public);

create policy "cellars_insert_creator" on public.cellars
  for insert to authenticated
  with check (created_by = (select auth.uid()));

-- planted: db.policy-standard-only (control) — restrictive policy using only standard PostgreSQL; narrows access, never widens it
create policy "tasting_notes_valid_score" on public.tasting_notes
  as restrictive
  for select
  using (score is null or score between 0 and 100);

-- planted: db.view-security-invoker (tie) — view with security_invoker calling auth.uid()
-- source: RLS#expose-a-view-safely (read 2026-11-26)
create view public.my_bottles
with (security_invoker = true)
as
select id, cellar_id, name, vintage, quantity
from public.bottles
where added_by = auth.uid();

grant select on public.my_bottles to authenticated;

-- planted: db.matview-helper (tie) — materialized view calling auth.role(); evaluated at refresh time, not per reader
-- source: HELP (auth.role() body) (read 2026-11-26)
create materialized view public.cellar_stats as
select
  c.id as cellar_id,
  count(b.id) as bottle_count,
  coalesce(sum(b.quantity), 0) as total_quantity,
  auth.role() as refreshed_as_role
from public.cellars c
left join public.bottles b on b.cellar_id = c.id
group by c.id;

-- Materialized views ignore RLS, so keep the counts away from client roles.
revoke all on public.cellar_stats from anon, authenticated;
grant select on public.cellar_stats to service_role;

-- planted: db.function-plpgsql-helpers (tie) — PL/pgSQL function calling auth.uid() and auth.role()
-- source: FUNC (security invoker default, search_path) (read 2026-11-26)
create function public.add_bottle(cellar uuid, bottle_name text, bottle_vintage int)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_id bigint;
begin
  if caller is null or auth.role() <> 'authenticated' then
    raise exception 'sign in to add a bottle' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.members m where m.cellar_id = add_bottle.cellar and m.user_id = caller
  ) then
    raise exception 'not a member of this cellar' using errcode = '42501';
  end if;
  insert into public.bottles (cellar_id, name, vintage, added_by)
  values (add_bottle.cellar, bottle_name, bottle_vintage, caller)
  returning id into new_id;
  return new_id;
end;
$$;

revoke execute on function public.add_bottle(uuid, text, int) from public, anon;
grant execute on function public.add_bottle(uuid, text, int) to authenticated;

-- planted: db.function-dynamic-sql (tie) — dynamic SQL, one statement built with format() and one string that calls auth.uid()
-- source: FUNC (security invoker default, search_path) (read 2026-11-26)
create function public.count_rows(target text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  n bigint;
  caller uuid;
begin
  execute format('select count(*) from public.%I', target) into n;
  execute 'select auth.uid()' into caller;
  raise notice 'counted % rows for %', n, caller;
  return n;
end;
$$;

-- Dynamic table names are for administrators only.
revoke execute on function public.count_rows(text) from public, anon, authenticated;
grant execute on function public.count_rows(text) to service_role;

-- planted: db.function-plain-sql (control) — plain SQL function with no platform reference
create function public.bottle_age(vintage int, in_year int)
returns int
language sql
immutable
as $$
  select in_year - vintage
$$;
