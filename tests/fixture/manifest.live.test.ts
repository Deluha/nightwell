// Live: needs Docker and a started fixture (`npm run fixture:start`); run with NIGHTWELL_LIVE=1.
// Proves that every database object in fixture/manifest.yaml exists in the running fixture. The SQL goes
// to psql on standard input and every identifier goes in as a psql variable (`:'name'`), never into the
// SQL text, so a hostile name cannot change a query. Reads of the throwaway fixture's cron.job,
// vault.secrets and storage.buckets are fine here; the hosted database is never touched.
import { spawn } from "node:child_process";
import { beforeAll, describe, expect, test } from "vitest";
import { isObjectKind, isRow, manifestEntries, OBJECT_KEYS, type ObjectKind, type Row } from "./manifest.ts";

const CONTAINER = "supabase_db_cellarbook";

// Each query returns one row: how many catalog rows match. The variables are the fields of a manifest
// object, with `table` and `column` named tbl and col, `privilege` priv and `on` on_kind.
const SCHEMA_JOIN = "join pg_namespace n on n.oid = c.relnamespace";
const relation = (kinds: string, extra = "") =>
  `select count(*) from pg_class c ${SCHEMA_JOIN} where n.nspname = :'schema' and c.relname = :'name' and c.relkind in (${kinds}) ${extra}`;
const attribute = (extra = "") =>
  `select count(*) from pg_attribute a join pg_class c on c.oid = a.attrelid ${SCHEMA_JOIN}
   where n.nspname = :'schema' and c.relname = :'tbl' and a.attname = :'name' and a.attnum > 0 and not a.attisdropped ${extra}`;

const QUERIES: Record<ObjectKind, string> = {
  schema: "select count(*) from pg_namespace where nspname = :'name'",
  table: relation("'r', 'p'"),
  view: relation("'v'"),
  "materialized-view": relation("'m'"),
  index: relation("'i', 'I'"),
  column: attribute(),
  "column-default": attribute(
    "and exists (select 1 from pg_attrdef d where d.adrelid = a.attrelid and d.adnum = a.attnum)",
  ),
  constraint: `select count(*) from pg_constraint k join pg_class c on c.oid = k.conrelid ${SCHEMA_JOIN}
    where n.nspname = :'schema' and c.relname = :'tbl' and k.conname = :'name'`,
  policy: `select count(*) from pg_policy p join pg_class c on c.oid = p.polrelid ${SCHEMA_JOIN}
    where n.nspname = :'schema' and c.relname = :'tbl' and p.polname = :'name'`,
  rls: `select count(*) from pg_class c ${SCHEMA_JOIN}
    where n.nspname = :'schema' and c.relname = :'tbl' and c.relrowsecurity`,
  function: `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = :'schema' and p.proname = :'name' and pg_get_function_identity_arguments(p.oid) = :'args'`,
  trigger: `select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid ${SCHEMA_JOIN}
    where n.nspname = :'schema' and c.relname = :'tbl' and t.tgname = :'name' and not t.tgisinternal`,
  extension: `select count(*) from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname = :'name' and (:'schema' = '' or n.nspname = :'schema')`,
  publication: "select count(*) from pg_publication where pubname = :'name'",
  "publication-table": `select count(*) from pg_publication_rel r join pg_publication p on p.oid = r.prpubid
    join pg_class c on c.oid = r.prrelid ${SCHEMA_JOIN}
    where p.pubname = :'name' and n.nspname = :'schema' and c.relname = :'tbl'`,
  "replica-identity": `select count(*) from pg_class c ${SCHEMA_JOIN}
    where n.nspname = :'schema' and c.relname = :'tbl'
    and c.relreplident::text = case :'setting' when 'default' then 'd' when 'nothing' then 'n' when 'full' then 'f' when 'index' then 'i' end`,
  "role-setting": `select count(*) from pg_db_role_setting s join pg_roles r on r.oid = s.setrole
    cross join lateral unnest(s.setconfig) as kv
    where r.rolname = :'role' and split_part(kv, '=', 1) = :'setting'`,
  "cron-job": "select count(*) from cron.job where jobname = :'name'",
  "vault-secret": "select count(*) from vault.secrets where name = :'name'",
  queue: "select count(*) from pgmq.list_queues() where queue_name = :'name'",
  "foreign-server": "select count(*) from pg_foreign_server where srvname = :'name'",
  "user-mapping": "select count(*) from pg_user_mappings where srvname = :'name' and usename = :'role'",
  "foreign-table": `select count(*) from pg_foreign_table f join pg_class c on c.oid = f.ftrelid ${SCHEMA_JOIN}
    where n.nspname = :'schema' and c.relname = :'name'`,
  bucket: "select count(*) from storage.buckets where id = :'name'",
  comment: `select count(*) from pg_description d join pg_class c on c.oid = d.objoid ${SCHEMA_JOIN}
    where d.classoid = 'pg_class'::regclass and n.nspname = :'schema' and c.relname = :'tbl'
    and d.objsubid = case when :'col' = '' then 0
      else coalesce((select a.attnum from pg_attribute a where a.attrelid = c.oid and a.attname = :'col'), -1) end`,
  operator: `select count(*) from pg_operator o join pg_namespace n on n.oid = o.oprnamespace
    where n.nspname = :'schema' and o.oprname = :'name'
    and format('%s, %s', o.oprleft::regtype, o.oprright::regtype) = :'args'`,
  "default-privilege": `select count(*) from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
    cross join lateral aclexplode(d.defaclacl) a join pg_roles r on r.oid = a.grantee
    where n.nspname = :'schema' and r.rolname = :'role' and a.privilege_type = upper(:'priv')
    and d.defaclobjtype::text = case :'name' when 'tables' then 'r' when 'functions' then 'f' end`,
  grant: `select count(*) from (
      select c.relacl as acl from pg_class c ${SCHEMA_JOIN}
        where :'on_kind' = 'table' and n.nspname = :'schema' and c.relname = :'name'
      union all
      select p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where :'on_kind' = 'function' and n.nspname = :'schema' and p.proname = :'name'
        and pg_get_function_identity_arguments(p.oid) = :'args'
      union all
      select n.nspacl from pg_namespace n where :'on_kind' = 'schema' and n.nspname = :'name'
    ) o cross join lateral aclexplode(o.acl) a join pg_roles r on r.oid = a.grantee
    where r.rolname = :'role' and a.privilege_type = upper(:'priv')`,
};

// The manifest field behind each psql variable; every variable is always set, empty when absent.
const VARIABLES = {
  schema: "schema",
  name: "name",
  tbl: "table",
  col: "column",
  role: "role",
  args: "args",
  setting: "setting",
  priv: "privilege",
  on_kind: "on",
} as const satisfies Record<string, (typeof OBJECT_KEYS)[number]>;

function psql(sql: string, object: Row): Promise<string> {
  const variables = Object.entries(VARIABLES).flatMap(([variable, field]) => {
    const value = object[field];
    return ["-v", `${variable}=${typeof value === "string" ? value : ""}`];
  });
  const args = ["exec", "-i", CONTAINER, "psql", "-U", "postgres", "-d", "postgres", "-At"];
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [...args, "-v", "ON_ERROR_STOP=1", ...variables, "-f", "-"]);
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => (out += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (err += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`psql exited with ${String(code)}: ${err.slice(0, 300)}`));
    });
    child.stdin.end(sql);
  });
}

describe.skipIf(process.env["NIGHTWELL_LIVE"] !== "1")("the manifest's database entries", () => {
  const entries = manifestEntries().filter((entry) => String(entry["id"]).startsWith("db."));
  let major = 0;

  beforeAll(async () => {
    major = Math.floor(Number(await psql("show server_version_num;", {})) / 10000);
  });

  // Test names carry the id only: object names may be hostile and never reach the output.
  test.each(entries.map((entry) => [String(entry["id"]), entry] as const))(
    "%s exists in the running fixture",
    { timeout: 60_000 },
    async (_id, entry) => {
      const only = entry["postgres_major"];
      const location = entry["location"];
      const objects = isRow(location) ? location["database"] : undefined;
      expect(Array.isArray(objects)).toBe(true);
      if (typeof only === "number" && only !== major) return; // the objects exist on another major only
      const missing = await Promise.all(
        (objects as unknown[]).map(async (object, index) => {
          if (!isRow(object) || !isObjectKind(object["object"])) return `#${String(index)}: unknown kind`;
          const found = Number(await psql(`${QUERIES[object["object"]]};`, object));
          return found >= 1 ? "" : `#${String(index)}: ${object["object"]} not found`;
        }),
      );
      expect(missing.filter((line) => line !== "")).toEqual([]);
    },
  );
});
