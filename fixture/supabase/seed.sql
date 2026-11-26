-- Synthetic demo data only. Emails use the reserved example.com domain; no real people or credentials.
-- auth.users has no password set, so these accounts cannot sign in.
-- aud and role 'authenticated' follow what GoTrue stores for a normal user (unverified in the sources read).

insert into auth.users (id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'ada@example.com',
    '{"display_name": "Ada Example"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'ben@example.com',
    '{"display_name": "Ben Example"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'cy@example.com',
    '{"display_name": "Cy Example"}', '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00');

insert into public.cellars (id, name, created_by, created_at)
values
  ('10000000-0000-4000-8000-000000000001', 'Example Cellar One', '00000000-0000-4000-8000-000000000001', '2026-01-02 00:00:00+00'),
  ('10000000-0000-4000-8000-000000000002', 'Example Cellar Two', '00000000-0000-4000-8000-000000000003', '2026-01-02 00:00:00+00');

insert into public.members (cellar_id, user_id, role)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'owner'),
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'member'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'owner'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'member');

insert into public.bottles (cellar_id, name, vintage, quantity, added_by)
values
  ('10000000-0000-4000-8000-000000000001', 'Example Red', 2015, 6, '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000001', 'Example White', 2020, 3, '00000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000001', 'Example Rose', 2022, 12, '00000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'Example Sparkling', 2018, 2, '00000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000002', 'Example Dessert', 2010, 1, '00000000-0000-4000-8000-000000000003');

insert into public.tasting_notes (bottle_id, author_id, tasted_on, score, note)
values
  (1, '00000000-0000-4000-8000-000000000001', '2025-03-14', 88, 'Example note: dark fruit.'),
  (2, '00000000-0000-4000-8000-000000000002', '2025-11-02', 82, 'Example note: crisp.'),
  (1, '00000000-0000-4000-8000-000000000002', '2026-02-20', 90, 'Example note: balanced.'),
  (4, '00000000-0000-4000-8000-000000000003', '2026-05-09', 85, 'Example note: lively.'),
  (5, '00000000-0000-4000-8000-000000000003', '2026-08-30', 91, 'Example note: sweet.');
