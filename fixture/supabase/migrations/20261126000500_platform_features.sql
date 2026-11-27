-- Cellarbook platform features: extensions, a webhook, Vault, cron, a queue, a foreign server, an auth
-- hook, REST-exposed functions, a PostgREST role setting and a PostgreSQL 15 only block.
-- Synthetic demo for Nightwell: every host ends in .invalid (RFC 2606) and no value is a credential.
--
-- Adapted from the supabase/supabase docs (Apache-2.0, LICENSE read 2026-11-26).

-- ---------------------------------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------------------------------

-- planted: db.ext-pg-graphql (tie) — Supabase-maintained extension; the doc enables it without a schema
create extension if not exists pg_graphql;

-- planted: db.ext-vector (tie) — third-party open source extension, installed in the extensions schema
create extension if not exists vector with schema extensions;

-- planted: db.ext-pg-jsonschema (tie) — Supabase-maintained extension, installed in the extensions schema
create extension if not exists pg_jsonschema with schema extensions;

-- planted: db.ext-wrappers (tie) — Supabase-maintained Wrappers framework
create extension if not exists wrappers with schema extensions;

-- planted: db.ext-index-advisor (tie) — Supabase-maintained extension; cascade also creates hypopg
create extension if not exists index_advisor with schema extensions cascade;

-- planted: db.ext-pg-cron (tie) — scheduler; the schema it creates is cron
create extension if not exists pg_cron;

-- planted: db.ext-pgmq (tie) — queue extension; creates its own pgmq schema
create extension if not exists pgmq;

-- planted: db.ext-uuid-ossp (control) — ships with PostgreSQL
create extension if not exists "uuid-ossp" with schema extensions;

-- planted: db.ext-pgcrypto (control) — ships with PostgreSQL
create extension if not exists pgcrypto with schema extensions;

-- planted: db.ext-postgres-fdw (control) — ships with PostgreSQL
-- The doc creates it without a schema; this keeps public clean.
create extension if not exists postgres_fdw with schema extensions;

-- ---------------------------------------------------------------------------------------------------
-- Calls qualified with the extensions schema
-- ---------------------------------------------------------------------------------------------------

-- planted: db.extensions-qualified-default (tie) — column default calls extensions.uuid_generate_v4(); check calls extensions.jsonb_matches_schema()
create table public.shelves (
  id uuid primary key default extensions.uuid_generate_v4(),
  cellar_id uuid not null references public.cellars (id) on delete cascade,
  label text not null,
  layout jsonb check (
    layout is null
    or extensions.jsonb_matches_schema(
      '{"type": "object", "required": ["rows"], "properties": {"rows": {"type": "integer", "minimum": 1}}}',
      layout
    )
  )
);

create index shelves_cellar_id_idx on public.shelves (cellar_id);

alter table public.shelves enable row level security;
revoke all on table public.shelves from anon, authenticated;
grant select on table public.shelves to authenticated;

create policy "shelves_select_member" on public.shelves
  for select to authenticated
  using ((select app_private.is_cellar_member(cellar_id)));

-- planted: db.vector-column (tie) — vector column typed through the extensions schema
-- It sits in its own table so that bottles fails to load only on its auth references, and this table only
-- on the extensions schema.
create table public.bottle_embeddings (
  bottle_id bigint primary key references public.bottles (id),
  flavour_embedding extensions.vector(3)
);

alter table public.bottle_embeddings enable row level security;
revoke all on table public.bottle_embeddings from anon, authenticated;

-- planted: db.function-pgcrypto-mixed (tie) — pgcrypto's gen_random_bytes called through the extensions schema, next to a core function
create function public.new_share_code()
returns text
language sql
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(6), 'hex') || '-' || substr(gen_random_uuid()::text, 1, 4)
$$;

-- ---------------------------------------------------------------------------------------------------
-- Webhook, Vault, cron, queue
-- ---------------------------------------------------------------------------------------------------

-- planted: db.webhook-trigger (tie) — database webhook: trigger executing supabase_functions.http_request
-- The host never resolves; no secret is sent in the headers.
create trigger new_bottle_webhook after insert
on public.bottles for each row
execute function supabase_functions.http_request(
  'http://cellarbook.invalid/functions/v1/new-bottle-hook',
  'POST',
  '{"Content-Type":"application/json"}',
  '{}',
  '1000'
);

-- planted: db.vault-secret (tie) — Vault secret created by SQL; the value is a synthetic non-credential
select vault.create_secret('not-a-real-token', 'restock_token', 'Synthetic placeholder, not a credential');

-- planted: db.cron-job-http-post (tie) — pg_cron job calling net.http_post with a Vault-held key
-- The secret goes in the `apikey` header, as the doc shows. The host never resolves.
select cron.schedule(
  'nightly-restock',
  '0 3 * * *',
  $$
  select
    net.http_post(
      url := 'https://cellarbook.invalid/functions/v1/restock',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'restock_token')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- planted: db.pgmq-queue (tie) — queue created and written to through pgmq
select pgmq.create('restock_requests');

create function public.request_restock(bottle bigint)
returns bigint
language sql
set search_path = ''
as $$
  select pgmq.send('restock_requests', jsonb_build_object('bottle_id', request_restock.bottle))
$$;

-- Only the service role may queue restocks.
revoke execute on function public.request_restock(bigint) from public, anon, authenticated;
grant execute on function public.request_restock(bigint) to service_role;

-- ---------------------------------------------------------------------------------------------------
-- Foreign server
-- ---------------------------------------------------------------------------------------------------

-- planted: db.foreign-server-postgres-fdw (control) — postgres_fdw server, user mapping and foreign table; never queried (the host does not resolve)
create server cellar_archive
  foreign data wrapper postgres_fdw
  options (host 'archive.invalid', port '5432', dbname 'archive');

create user mapping for postgres
  server cellar_archive
  options (user 'archive_reader', password 'not-a-real-password');

create foreign table public.archived_bottles (
  id bigint,
  name text,
  vintage int
)
  server cellar_archive
  options (schema_name 'public', table_name 'bottles');

-- Foreign tables have no RLS, so keep them away from the client roles.
revoke all on table public.archived_bottles from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Auth hook
-- ---------------------------------------------------------------------------------------------------

-- planted: db.auth-hook-custom-access-token (tie) — Postgres function used as the custom access token hook (declared in config.jsonc auth.hook.custom_access_token)
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims jsonb;
  cellar_ids jsonb;
begin
  select coalesce(jsonb_agg(m.cellar_id), '[]'::jsonb) into cellar_ids
  from public.members m
  where m.user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';
  if jsonb_typeof(claims -> 'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}');
  end if;
  claims := jsonb_set(claims, '{app_metadata, cellar_ids}', cellar_ids);

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- The members table has RLS: let the auth service read it (the doc grants the table and alters the policies).
grant select on table public.members to supabase_auth_admin;
create policy "members_select_auth_admin" on public.members
  for select to supabase_auth_admin
  using (true);

-- ---------------------------------------------------------------------------------------------------
-- Functions reachable over the REST API
-- ---------------------------------------------------------------------------------------------------

-- planted: db.rpc-search-bottles (tie) — REST-exposed function, security invoker, execute granted to authenticated
create function public.search_bottles(q text)
returns setof public.bottles
language sql
stable
security invoker
set search_path = ''
as $$
  select * from public.bottles b where b.name ilike '%' || search_bottles.q || '%'
$$;

revoke execute on function public.search_bottles(text) from public, anon;
grant execute on function public.search_bottles(text) to authenticated;

-- planted: db.rpc-cellar-summary (tie) — REST-exposed security-definer function with an empty search_path
create function public.cellar_summary(cellar uuid)
returns table (bottle_count bigint, total_quantity bigint)
language plpgsql
stable
security definer set search_path = ''
as $$
begin
  if not (select app_private.is_cellar_member(cellar_summary.cellar)) then
    raise exception 'not a member of this cellar' using errcode = '42501';
  end if;
  return query
    select count(b.id), coalesce(sum(b.quantity), 0)::bigint
    from public.bottles b
    where b.cellar_id = cellar_summary.cellar;
end;
$$;

revoke execute on function public.cellar_summary(uuid) from public, anon;
grant execute on function public.cellar_summary(uuid) to authenticated;

-- planted: db.rpc-anon-execute (tie) — function executable by the anon role through an explicit grant
create function public.public_cellar_count()
returns bigint
language sql
stable
set search_path = ''
as $$
  select count(*) from public.cellars
$$;

revoke execute on function public.public_cellar_count() from public;
grant execute on function public.public_cellar_count() to anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- PostgREST role setting
-- ---------------------------------------------------------------------------------------------------

-- planted: db.pgrst-pre-request (tie) — PostgREST pre-request function set on the authenticator role
create function public.check_request()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  null; -- the fixture adds no request checks
end;
$$;

revoke execute on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, service_role;

alter role authenticator
  set pgrst.db_pre_request = 'public.check_request';

notify pgrst, 'reload config';

-- ---------------------------------------------------------------------------------------------------
-- PostgreSQL 15 only: pgjwt and plv8 are deprecated from PostgreSQL 17 (docs read 2026-11-26)
-- ---------------------------------------------------------------------------------------------------

-- planted: db.pg15-only-pgjwt-plv8 (tie) — pgjwt and plv8, created only below PostgreSQL 16; the block does nothing on 17
do $do$
begin
  if current_setting('server_version_num')::int < 160000 then
    create extension if not exists pgjwt with schema extensions;
    create extension if not exists plv8;

    execute $fn$
      create function public.sign_share_link(cellar uuid)
      returns text
      language sql
      set search_path = ''
      as $body$
        select extensions.sign(
          json_build_object('cellar', sign_share_link.cellar),
          'not-a-real-secret',
          'HS256'
        )
      $body$
    $fn$;

    execute $fn$
      create function public.slugify(input text)
      returns text
      language plv8
      as $body$
        return input.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      $body$
    $fn$;

    revoke execute on function public.sign_share_link(uuid) from public, anon, authenticated;
    revoke execute on function public.slugify(text) from public, anon, authenticated;
  end if;
end
$do$;
