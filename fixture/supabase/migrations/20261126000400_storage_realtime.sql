-- Cellarbook storage and realtime. No storage or realtime service runs in the fixture, so everything
-- here is SQL: buckets, storage.objects policies, the realtime publication, a broadcast trigger and
-- realtime.messages policies. Synthetic demo for Nightwell.
--
-- Adapted from the supabase/supabase docs (Apache-2.0, LICENSE read 2026-11-26). Sources (all read 2026-11-26):
--   BUCKETS = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/storage/buckets/creating-buckets.mdx
--   ACCESS  = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/storage/security/access-control.mdx
--   HELPERS = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/storage/schema/helper-functions.mdx
--   PGCHG   = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/realtime/postgres-changes.mdx
--   BCAST   = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/realtime/broadcast.mdx
--   SUBDB   = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/realtime/subscribing-to-database-changes.mdx
--   AUTHZ   = https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/realtime/authorization.mdx

-- planted: db.storage-bucket-private (tie) — private bucket created by SQL
-- source: BUCKETS (insert into storage.buckets (id, name, public)) (read 2026-11-26)
insert into storage.buckets (id, name, public)
values ('labels', 'labels', false);

-- planted: db.storage-bucket-public (tie) — public bucket created by SQL
-- source: BUCKETS (read 2026-11-26)
insert into storage.buckets (id, name, public)
values ('cellar-photos', 'cellar-photos', true);

-- planted: db.storage-policy-folder-per-user (tie) — storage.foldername() compared with the caller's uid
-- source: ACCESS (folder named by the user id) and HELPERS#storage.foldername (read 2026-11-26)
-- The doc compares with (select auth.jwt()->>'sub'); this uses (select auth.uid())::text.
create policy "labels_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'labels' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "labels_select_own_folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'labels' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "labels_update_own_folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'labels' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'labels' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "labels_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'labels' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- planted: db.storage-policy-extension (tie) — storage.extension() limits uploads to images
-- source: HELPERS#storage.extension (read 2026-11-26)
-- Restrictive, so it narrows the permissive policies above instead of adding access (the doc's form is permissive).
create policy "labels_images_only" on storage.objects
  as restrictive
  for insert to authenticated
  with check (bucket_id <> 'labels' or storage.extension(name) in ('png', 'jpg'));

-- planted: db.storage-policy-filename (tie) — storage.filename() in a policy naming `public`
-- source: HELPERS#storage.filename (read 2026-11-26)
create policy "labels_shared_download" on storage.objects
  for select to public
  using (bucket_id = 'labels' and storage.filename(name) = 'shared-label.png');

-- planted: db.storage-policy-public-read-anon (tie) — anon may read a public bucket
-- source: BUCKETS (public buckets) and ACCESS (policies on storage.objects) (read 2026-11-26)
create policy "cellar_photos_public_read" on storage.objects
  for select to anon
  using (bucket_id = 'cellar-photos');

-- planted: db.realtime-publication-tables (tie) — tables added to the supabase_realtime publication
-- source: PGCHG (alter publication supabase_realtime add table) (read 2026-11-26)
-- tasting_notes is partitioned; the docs read say nothing about partitions, so the publication keeps its default
-- (publish_via_partition_root = false) and changes are published under the partition names.
alter publication supabase_realtime add table public.tasting_notes, public.bottles;

-- planted: db.replica-identity-full (tie) — old records on update and delete
-- source: PGCHG#receiving-old-records (read 2026-11-26)
alter table public.bottles replica identity full;

-- planted: db.broadcast-changes-trigger (tie) — trigger function calling realtime.broadcast_changes, in the documented argument order
-- source: SUBDB and BCAST (read 2026-11-26)
create function public.broadcast_tasting_room()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'cellar:' || coalesce(new.cellar_id, old.cellar_id)::text, -- topic
    tg_op,                                                     -- event
    tg_op,                                                     -- operation
    tg_table_name,                                             -- table
    tg_table_schema,                                           -- schema
    new,                                                       -- new record
    old                                                        -- old record
  );
  return null;
end;
$$;

revoke execute on function public.broadcast_tasting_room() from public, anon, authenticated;

create trigger broadcast_tasting_room
  after insert or update or delete on public.bottles
  for each row execute function public.broadcast_tasting_room();

-- planted: db.realtime-send-call (tie) — direct call to realtime.send from a function
-- source: BCAST (realtime.send(payload, event, topic, private)) (read 2026-11-26)
create function public.announce_pour(cellar uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
begin
  if not (select app_private.is_cellar_member(announce_pour.cellar)) then
    raise exception 'not a member of this cellar' using errcode = '42501';
  end if;
  perform realtime.send(
    payload => jsonb_build_object('pour', true),
    event => 'pour',
    topic => 'cellar:' || announce_pour.cellar::text,
    private => true
  );
end;
$$;

revoke execute on function public.announce_pour(uuid) from public, anon;
grant execute on function public.announce_pour(uuid) to authenticated;

-- Reads the cellar id out of a 'cellar:<uuid>' topic; null for any other topic.
-- planted: db.topic-parser (control) — plain SQL, no platform reference
create function app_private.cellar_from_topic(topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when topic ~ '^cellar:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then substr(topic, 8)::uuid
  end
$$;

grant execute on function app_private.cellar_from_topic(text) to authenticated;

-- planted: db.realtime-policy-broadcast-receive (tie) — policy on realtime.messages using realtime.topic() and the extension column
-- source: AUTHZ (allow a user to join and read a Broadcast topic) (read 2026-11-26)
create policy "cellar_members_receive_broadcast" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast')
    and (select app_private.is_cellar_member(app_private.cellar_from_topic((select realtime.topic()))))
  );

-- planted: db.realtime-policy-presence-send (tie) — policy on realtime.messages for presence on the same topics
-- source: AUTHZ (presence: insert policy where extension is 'presence') (read 2026-11-26)
create policy "cellar_members_track_presence" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('presence')
    and (select app_private.is_cellar_member(app_private.cellar_from_topic((select realtime.topic()))))
  );
