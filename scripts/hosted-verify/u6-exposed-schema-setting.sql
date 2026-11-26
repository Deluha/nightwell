-- U6: is the exposed-schema list readable from the database as a pgrst.* role or database setting?
-- Returns the scope, the name of the platform role (any other role is reported as 'other') and the
-- setting's name. Never returns a setting's value: the value would list the project's own schemas.
select
  case
    when s.setrole = 0 then 'database'
    when s.setdatabase = 0 then 'role'
    else 'role-in-database'
  end as scope,
  case
    when r.rolname is null then null
    when r.rolname in ('authenticator', 'anon', 'authenticated', 'service_role', 'postgres', 'supabase_admin')
      then r.rolname
    else 'other'
  end as platform_role,
  pg_catalog.split_part(setting.entry, '=', 1) as setting_name
from pg_catalog.pg_db_role_setting s
left join pg_catalog.pg_roles r on r.oid = s.setrole
cross join lateral pg_catalog.unnest(s.setconfig) as setting(entry)
where pg_catalog.split_part(setting.entry, '=', 1) like 'pgrst.%'
order by 1, 2, 3
