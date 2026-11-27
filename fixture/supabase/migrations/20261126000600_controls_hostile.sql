-- Cellarbook controls and hostile content: portable objects, near-misses, canary credentials, hostile
-- identifiers and literals, shadowing objects and a policy that calls a canary function.
-- Synthetic demo for Nightwell. Every canary is a fixed synthetic value listed in fixture/canaries.json;
-- every host ends in .invalid (RFC 2606). No raw control characters appear in this file: escapes only.
--
-- Adapted from the supabase/supabase docs (Apache-2.0, LICENSE read 2026-11-26).

-- ---------------------------------------------------------------------------------------------------
-- Controls
-- ---------------------------------------------------------------------------------------------------

-- planted: db.control-portable-table (control) — standard SQL only, no foreign keys, a standard index
create table public.grape_varieties (
  id int generated always as identity primary key,
  name text not null,
  colour text not null check (colour in ('red', 'white', 'rose'))
);

create index grape_varieties_name_idx on public.grape_varieties (name);

alter table public.grape_varieties enable row level security;
revoke all on table public.grape_varieties from anon, authenticated;

-- planted: db.control-comment-mentions-helper (control) — a comment that only mentions a helper as text
comment on table public.grape_varieties is 'Grape reference list; filtered by auth.uid() in an earlier design';

-- planted: db.control-function-returns-helper-text (control) — a function body that only returns a helper name as a string
create function public.helper_name_text()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'auth.uid()'::text
$$;

-- ---------------------------------------------------------------------------------------------------
-- Near-misses, one per rule family (all controls)
-- ---------------------------------------------------------------------------------------------------

-- planted: db.nearmiss-schema-prefix (control) — family: managed-schema names (a user schema that starts like auth)
create schema auth_audit;

create table auth_audit.log_entries (
  id bigint generated always as identity primary key,
  entry text not null
);

alter table auth_audit.log_entries enable row level security;

-- planted: db.nearmiss-table-objects (control) — family: storage objects (a user table named objects in a look-alike schema)
create table auth_audit.objects (
  id bigint generated always as identity primary key,
  name text not null
);

alter table auth_audit.objects enable row level security;

-- planted: db.nearmiss-role-name-in-text (control) — family: built-in roles (a role-like name only in a comment and a string; no role is created)
-- The role authenticated_reader does not exist; it is named here only as text.
create function public.reader_label()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'authenticated_reader'::text
$$;

-- planted: db.nearmiss-publication (control) — family: the realtime publication (a user publication on a user table)
create publication cellar_exports for table public.grape_varieties;

-- planted: db.nearmiss-http-request-trigger (control) — family: webhooks (a trigger calling a user function named http_request, not supabase_functions.http_request)
create function public.http_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  return new;
end;
$$;

create trigger grape_varieties_http_request
  after insert on public.grape_varieties
  for each row execute function public.http_request();

-- planted: db.nearmiss-realtime-send-name (control) — family: realtime broadcast (a private-schema function named realtime_send)
create function app_private.realtime_send(payload jsonb)
returns void
language sql
set search_path = ''
as $$
  select null::void
$$;

-- planted: db.nearmiss-private-function-no-grants (control) — family: function privileges (a private-schema function granted to nobody)
create function app_private.ungranted_helper()
returns int
language sql
immutable
set search_path = ''
as $$
  select 1
$$;

revoke execute on function app_private.ungranted_helper() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Canary credentials in the database
-- ---------------------------------------------------------------------------------------------------

-- planted: db.canary-webhook-headers-and-path (tie) — canaries in webhook headers (platform-secret-key) and URL path (dictionary-word)
create trigger grape_webhook after insert
on public.grape_varieties for each row
execute function supabase_functions.http_request(
  'http://cellarbook.invalid/functions/v1/cellardoor-canary-password',
  'POST',
  '{"Content-Type":"application/json","Authorization":"Bearer sb_secret_NIGHTWELLCANARY0000000001"}',
  '{}',
  '1000'
);

-- planted: db.canary-cron-command (tie) — canary in the cron command (legacy-jwt, in an apikey header)
select cron.schedule(
  'weekly-grape-sync',
  '0 4 * * 1',
  $$
  select
    net.http_post(
      url := 'https://cellarbook.invalid/functions/v1/grape-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJub25lIiwidHlwIjoiTklHSFRXRUxMLUNBTkFSWSJ9.eyJyb2xlIjoibmlnaHR3ZWxsLWNhbmFyeSIsInJlZiI6Im5vdC1hLXByb2plY3QifQ.bm90LWEtc2lnbmF0dXJl'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- planted: db.canary-role-setting (tie) — canary in a role setting (high-entropy)
-- The local postgres role may set only allow-listed prefixes; app.* is refused (42501), pgrst.* is accepted.
alter role authenticated set pgrst.cellar_partner_key = 'nwc_g11JH4_kk_4wrEW2ePlDnsD_EDipifiL';

-- planted: db.canary-user-mapping-option (tie) — canary in a user-mapping option (dictionary-word as the mapping password)
create user mapping for authenticated
  server cellar_archive
  options (user 'archive_reader', password 'cellardoor-canary-password');

-- planted: db.canary-server-option (control) — canary in a foreign-server option (dictionary-word as application_name)
alter server cellar_archive options (add application_name 'cellardoor-canary-password');

-- planted: db.canary-policy-literal (tie) — canary in a policy literal (platform-publishable-key) compared with a request header
create policy "grape_varieties_partner_header" on public.grape_varieties
  as restrictive
  for select to authenticated
  using (
    (nullif(current_setting('request.headers', true), '')::json ->> 'x-partner-key')
      = 'sb_publishable_NIGHTWELLCANARY0000000002'
  );

-- planted: db.canary-comment (control) — canaries in a comment text (email and high-entropy)
comment on column public.grape_varieties.name is
  'Contact canary.nightwell@example.com, reference nwc_g11JH4_kk_4wrEW2ePlDnsD_EDipifiL';

-- planted: db.canary-column-default (control) — canary as a column default (legacy-jwt)
alter table public.grape_varieties add column legacy_token text
  default 'eyJhbGciOiJub25lIiwidHlwIjoiTklHSFRXRUxMLUNBTkFSWSJ9.eyJyb2xlIjoibmlnaHR3ZWxsLWNhbmFyeSIsInJlZiI6Im5vdC1hLXByb2plY3QifQ.bm90LWEtc2lnbmF0dXJl';

-- planted: db.canary-view-literal (control) — canary as a literal column of a security_invoker view (platform-secret-key)
create view public.partner_feed
with (security_invoker = true)
as
select id, name, 'sb_secret_NIGHTWELLCANARY0000000001'::text as feed_key
from public.grape_varieties;

revoke all on public.partner_feed from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Hostile identifiers and literals (synthetic, harmless to call)
-- ---------------------------------------------------------------------------------------------------

-- planted: db.hostile-table-markup (control) — table name containing markup; columns carry a CI annotation, a terminal escape and a double quote
create table public."<script>alert(1)</script>" (
  id int primary key,
  "::error file=x::nightwell" text,
  U&"\001B[31mred" text,
  "say ""hi""" text
);

-- planted: db.hostile-table-group-and-columns (control) — table name with CI group syntax; columns carry a single quote, a backtick, a newline and path separators
create table public."##[group]nightwell" (
  id int primary key,
  "it's" text,
  "back`tick" text,
  U&"line\000Abreak" text,
  "../../etc/passwd" text,
  "back\slash" text
);

alter table public."<script>alert(1)</script>" enable row level security;
alter table public."##[group]nightwell" enable row level security;
revoke all on table public."<script>alert(1)</script>", public."##[group]nightwell" from anon, authenticated;

-- planted: db.hostile-comment (control) — comment text with an escape, CI syntax and a newline
comment on table public."<script>alert(1)</script>" is
  U&'\001B[31mred ::error file=x::nightwell\000Asecond line ../../etc/passwd';

-- planted: db.hostile-policy-names (control) — policy names with markup, a terminal escape, quotes and path separators
create policy "<script>alert(1)</script>" on public."<script>alert(1)</script>"
  for select to public using (false);
create policy U&"\001B[31mpolicy" on public."<script>alert(1)</script>"
  for select to public using (false);
create policy "it's ""quoted"" `tick`" on public."<script>alert(1)</script>"
  for select to public using (false);
create policy "../../etc/passwd\back" on public."<script>alert(1)</script>"
  for select to public using (false);

-- planted: db.hostile-function-names (control) — function names with CI syntax, markup, a terminal escape and quotes
create function public."##[group]fn"()
returns text language sql immutable set search_path = '' as $$ select 'ok'::text $$;
create function public."::error file=x::fn"()
returns text language sql immutable set search_path = '' as $$ select 'ok'::text $$;
create function public."<script>fn</script>"()
returns text language sql immutable set search_path = '' as $$ select 'ok'::text $$;
create function public.U&"\001B[31mfn"()
returns text language sql immutable set search_path = '' as $$ select 'ok'::text $$;
create function public."fn'quote""double`tick"()
returns text language sql immutable set search_path = '' as $$ select 'ok'::text $$;

-- planted: db.hostile-function-body-literal (control) — string literal in a function body with markup, an escape, CI syntax, a newline, quotes and path separators
create function public.hostile_text()
returns text
language sql
immutable
set search_path = ''
as $$
  select U&'<script>alert(1)</script> \001B[31mred ::error file=x::nightwell ##[group]g \000Aline2 it''s "q" `t` ../../etc/passwd \\ back'::text
$$;

-- planted: db.hostile-view-literal (control) — string literal in a view with the same hostile content
create view public.hostile_view as
select U&'<script>alert(1)</script> \001B[31mred ::error file=x::nightwell ##[group]g \000Aline2 it''s "q" `t` ../../etc/passwd \\ back'::text as label;

revoke all on public.hostile_view from anon, authenticated;

-- ---------------------------------------------------------------------------------------------------
-- Shadowing objects in public (canary functions: any call raises an error naming itself)
-- ---------------------------------------------------------------------------------------------------
-- pg_catalog is searched first, so the built-ins still win for ordinary sessions.

-- planted: db.shadow-function-now (control) — a public function named like the built-in now()
create function public.now()
returns timestamptz
language plpgsql
as $$
begin
  raise exception 'nightwell canary: public.now called';
end;
$$;

-- planted: db.shadow-operator-equals (control) — a public operator named like the built-in = on (text, text)
create function public.canary_text_equals(text, text)
returns boolean
language plpgsql
as $$
begin
  raise exception 'nightwell canary: public.= called';
end;
$$;

create operator public.= (
  leftarg = text,
  rightarg = text,
  function = public.canary_text_equals
);

-- ---------------------------------------------------------------------------------------------------
-- A policy on a platform table that calls a canary function
-- ---------------------------------------------------------------------------------------------------

-- planted: db.canary-policy-function (control) — canary function; any call raises an error naming itself
create function app_private.canary_policy_check()
returns boolean
language plpgsql
as $$
begin
  raise exception 'nightwell canary: app_private.canary_policy_check called';
end;
$$;

grant execute on function app_private.canary_policy_check() to authenticated;

-- planted: db.canary-policy-on-platform-table (tie) — permissive policy on storage.buckets whose expression calls the canary function
create policy "buckets_canary" on storage.buckets
  for select to authenticated
  using (app_private.canary_policy_check());
