-- Cellarbook core schema: tenant tables, memberships, profiles, bottles, partitioned tasting notes.
-- Synthetic demo for Nightwell; no access control here (see the later migrations).
--
-- Adapted from: https://github.com/supabase/supabase/blob/49525599d17c04d4fa8e9e0fb64e89b0b53e9344/apps/docs/content/guides/auth/managing-user-data.mdx
-- (profiles trigger shape) and .../database/partitions.mdx (range partitioning shape).
-- Licence of supabase/supabase: Apache-2.0 (LICENSE read 2026-11-26).

-- Migrations must run as the non-superuser administrative role a hosted project gives its owner.
do $$
begin
  if (select rolsuper from pg_roles where rolname = current_user) then
    raise exception 'migrations must not run as a superuser (current role: %)', current_user;
  end if;
end
$$;

-- planted: db.cellars-auth-uid-default (tie) — column default calls auth.uid() and created_by references auth.users
create table public.cellars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz default now()
);

-- planted: db.members-auth-users-fk (tie) — foreign key into auth.users with on delete cascade
create table public.members (
  cellar_id uuid not null references public.cellars (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  primary key (cellar_id, user_id)
);

-- planted: db.profiles-auth-users-fk (tie) — profile id references auth.users with on delete cascade
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text
);

-- planted: db.profiles-auth-uid-check (tie) — check constraint calls auth.uid(); passes when no JWT is present (seed, service inserts)
-- NOT VALID makes it a statement of its own in a dump, apart from any other tie; new rows are still checked.
alter table public.profiles
  add constraint profiles_id_self check (auth.uid() is null or id = auth.uid()) not valid;

-- planted: db.profiles-new-user-trigger (tie) — security-definer function and trigger on auth.users create the profile row
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.bottles (
  id bigint generated always as identity primary key,
  cellar_id uuid not null references public.cellars (id),
  name text not null,
  vintage int,
  -- planted: db.bottles-quantity-check (control) — standard check constraint, no platform dependency
  quantity int not null default 0 check (quantity >= 0),
  -- planted: db.bottles-auth-uid-default (tie) — column default calls auth.uid()
  added_by uuid not null default auth.uid(),
  -- planted: db.bottles-generated-column (control) — generated column with an immutable expression
  vintage_decade int generated always as ((vintage / 10) * 10) stored
);

-- planted: db.tasting-notes-partitioned (control) — table partitioned by range, with an identity column, foreign keys and two partitions
create table public.tasting_notes (
  id bigint generated always as identity,
  bottle_id bigint not null references public.bottles (id),
  author_id uuid not null references auth.users (id),
  tasted_on date not null,
  score int check (score between 0 and 100),
  note text,
  primary key (id, tasted_on)
) partition by range (tasted_on);

create table public.tasting_notes_2025
  partition of public.tasting_notes
  for values from ('2025-01-01') to ('2026-01-01');

create table public.tasting_notes_2026
  partition of public.tasting_notes
  for values from ('2026-01-01') to ('2027-01-01');

-- planted: db.fk-indexes (control) — plain indexes on foreign key columns
create index cellars_created_by_idx on public.cellars (created_by);
create index members_user_id_idx on public.members (user_id);
create index bottles_cellar_id_idx on public.bottles (cellar_id);
create index tasting_notes_bottle_id_idx on public.tasting_notes (bottle_id);
create index tasting_notes_author_id_idx on public.tasting_notes (author_id);
