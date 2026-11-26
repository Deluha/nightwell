// The oracle's logic on small synthetic SQL and a tiny synthetic manifest: splitting a dump, the objects a
// statement creates, attribution to entries, and every verdict path. Offline: nothing here runs a database.
import { describe, expect, test } from "vitest";
import { loadModule } from "libpg-query";
import {
  attribute,
  buildLoadScript,
  identifiersIn,
  isManagedSchema,
  judge,
  normalizeArgs,
  oracleEntries,
  parseLoadOutput,
  rolesOf,
  splitDump,
  summarize,
  targetsOf,
  verdictOf,
  type Judgement,
  type Outcome,
  type OracleEntry,
  type PassResult,
  type Status,
  type Target,
} from "./oracle.ts";

await loadModule();

const targets = (sql: string): Target[] => splitDump(sql).flatMap(targetsOf);

describe("isManagedSchema", () => {
  test("knows the managed schemas, their prefix patterns and the user schemas", () => {
    for (const name of ["auth", "storage", "pg_toast", "pg_catalog", "_timescaledb_internal", "vault"]) {
      expect(isManagedSchema(name)).toBe(true);
    }
    for (const name of ["public", "app_private", "auth_audit", "extensions_extra"]) {
      expect(isManagedSchema(name)).toBe(false);
    }
  });
});

describe("splitDump", () => {
  test("drops psql meta-command lines and keeps the statements", () => {
    const parts = splitDump(
      "\\restrict abc\n-- a comment\nset x = 1;\n\\connect other\nselect 1;\n\\unrestrict abc\n",
    );
    expect(parts.map((part) => part.kind)).toEqual(["VariableSetStmt", "SelectStmt"]);
    expect(parts.map((part) => part.text)).toEqual(["set x = 1", "select 1"]);
    expect(parts.map((part) => part.index)).toEqual([0, 1]);
  });

  test("keeps a dollar-quoted body whole, semicolons and comments included", () => {
    const parts = splitDump(
      "create function f() returns int language plpgsql as $body$\nbegin\n  -- a; b\n  perform 1; return 2;\nend;\n$body$;\nselect 2;",
    );
    expect(parts).toHaveLength(2);
    expect(parts[0]?.text).toContain("perform 1; return 2;");
    expect(parts[0]?.text.endsWith("$body$")).toBe(true);
    expect(parts[1]?.text).toBe("select 2");
  });

  test("cuts by bytes, so multi-byte text before a statement does not shift it", () => {
    const parts = splitDump("select 'é€';\nselect 2;");
    expect(parts.map((part) => part.text)).toEqual(["select 'é€'", "select 2"]);
  });

  test("strips a leading block comment, nested ones included", () => {
    expect(splitDump("/* a /* b */ c */ select 1;")[0]?.text).toBe("select 1");
  });

  test("refuses a backslash command smuggled outside a quoted string", () => {
    expect(() => splitDump("select 1 \\! echo hi;")).toThrow();
  });

  test("keeps a backslash inside a quoted string", () => {
    expect(splitDump("select 'a \\ b';")[0]?.text).toBe("select 'a \\ b'");
  });
});

describe("targetsOf", () => {
  test("a table with defaults, checks, a generated column and a partition key", () => {
    const found = targets(`create table public.b (
      id bigint not null,
      who uuid default auth.uid(),
      g int generated always as (id / 10) stored,
      e extensions.vector(3),
      constraint c1 check (id >= 0),
      primary key (id)
    ) partition by range (id)`);
    expect(found).toContainEqual({ kind: "table", schema: "public", name: "b" });
    for (const name of ["id", "who", "g", "e"]) {
      expect(found).toContainEqual({ kind: "column", schema: "public", table: "b", name });
    }
    expect(found).toContainEqual({ kind: "column-default", schema: "public", table: "b", name: "who" });
    expect(found).toContainEqual({ kind: "constraint", schema: "public", table: "b", name: "c1" });
    expect(found.filter((one) => one.kind === "column-default")).toHaveLength(1);
  });

  test("a partition and its attachment", () => {
    expect(targets("create table public.p partition of public.t for values from (1) to (2)")).toContainEqual({
      kind: "table",
      schema: "public",
      name: "p",
    });
    const attach = targets("alter table only public.t attach partition public.p for values from (1) to (2)");
    expect(attach).toContainEqual({ kind: "table", schema: "public", name: "t" });
    expect(attach).toContainEqual({ kind: "table", schema: "public", name: "p" });
    const index = targets("alter index public.a attach partition public.b");
    expect(index).toEqual([
      { kind: "index", schema: "public", name: "a" },
      { kind: "index", schema: "public", name: "b" },
    ]);
  });

  test("alter table: constraint, row security, replica identity, owner and identity", () => {
    expect(targets("alter table only public.m add constraint k foreign key (u) references auth.users (id)")).toEqual([
      { kind: "constraint", schema: "public", table: "m", name: "k" },
    ]);
    expect(targets("alter table public.m enable row level security")).toEqual([
      { kind: "rls", schema: "public", table: "m" },
    ]);
    expect(targets("alter table public.m force row level security")).toEqual([
      { kind: "rls", schema: "public", table: "m" },
    ]);
    expect(targets("alter table only public.m replica identity full")).toEqual([
      { kind: "replica-identity", schema: "public", table: "m", setting: "full" },
    ]);
    expect(targets("alter table public.m owner to postgres")).toEqual([{ kind: "table", schema: "public", name: "m" }]);
    expect(targets("alter view public.v owner to postgres")).toEqual([{ kind: "view", schema: "public", name: "v" }]);
    expect(targets("alter materialized view public.v owner to postgres")).toEqual([
      { kind: "materialized-view", schema: "public", name: "v" },
    ]);
    expect(targets("alter foreign table public.v owner to postgres")).toEqual([
      { kind: "foreign-table", schema: "public", name: "v" },
    ]);
    const identity = targets(
      "alter table public.m alter column id add generated always as identity (sequence name public.m_id_seq start with 1)",
    );
    expect(identity).toContainEqual({ kind: "column", schema: "public", table: "m", name: "id" });
    expect(identity).toContainEqual({ kind: "sequence", schema: "public", name: "m_id_seq" });
    expect(targets("alter table public.m alter column c set default 1")).toEqual([
      { kind: "column-default", schema: "public", table: "m", name: "c" },
    ]);
    expect(targets("alter table public.m add column c boolean default false not null")).toEqual([
      { kind: "column", schema: "public", table: "m", name: "c" },
      { kind: "column-default", schema: "public", table: "m", name: "c" },
    ]);
  });

  test("schema, index, policy, trigger, views and refresh", () => {
    expect(targets("create schema s")).toEqual([{ kind: "schema", name: "s" }]);
    expect(targets("alter schema s owner to postgres")).toEqual([{ kind: "schema", name: "s" }]);
    expect(targets("create index i on only public.t using btree (a)")).toEqual([
      { kind: "index", schema: "public", name: "i" },
    ]);
    expect(targets("create policy p on public.t for select to authenticated using (true)")).toEqual([
      { kind: "policy", schema: "public", table: "t", name: "p" },
    ]);
    expect(
      targets("create trigger tg after insert on public.t for each row execute function supabase_functions.http_request('x')"),
    ).toEqual([{ kind: "trigger", schema: "public", table: "t", name: "tg" }]);
    expect(targets("create view public.v as select 1")).toEqual([{ kind: "view", schema: "public", name: "v" }]);
    expect(targets("create materialized view public.m as select 1 with no data")).toEqual([
      { kind: "materialized-view", schema: "public", name: "m" },
    ]);
    expect(targets("refresh materialized view public.m")).toEqual([
      { kind: "materialized-view", schema: "public", name: "m" },
    ]);
    expect(targets("create foreign table public.ft (id bigint) server s")).toEqual([
      { kind: "foreign-table", schema: "public", name: "ft" },
      { kind: "column", schema: "public", table: "ft", name: "id" },
    ]);
  });

  test("functions, with their signature as types only", () => {
    const create = targets(
      "create function app.f(cellar uuid, n integer, tags text[], out o int) returns int language sql as 'select 1'",
    );
    expect(create).toEqual([{ kind: "function", schema: "app", name: "f", args: "uuid,int4,text[]" }]);
    expect(targets("alter function app.f(cellar uuid, n integer, tags text[]) owner to postgres")).toEqual(create);
    expect(targets("create function public.g() returns int language sql as 'select 1'")).toEqual([
      { kind: "function", schema: "public", name: "g", args: "" },
    ]);
    expect(
      targets("create function public.h(i int) returns table(a int) language sql as 'select 1'")[0]?.args,
    ).toBe("int4");
  });

  test("operators", () => {
    expect(targets("create operator public.= (function = public.f, leftarg = text, rightarg = text)")).toEqual([
      { kind: "operator", schema: "public", name: "=", args: "text,text" },
    ]);
    expect(targets("alter operator public.= (text, text) owner to postgres")).toEqual([
      { kind: "operator", schema: "public", name: "=", args: "text,text" },
    ]);
  });

  test("comments", () => {
    expect(targets("comment on table public.t is 'x'")).toEqual([{ kind: "comment", schema: "public", table: "t" }]);
    expect(targets("comment on column public.t.c is 'x'")).toEqual([
      { kind: "comment", schema: "public", table: "t", column: "c" },
    ]);
    expect(targets("comment on schema public is 'x'")).toEqual([{ kind: "schema", name: "public" }]);
    expect(targets("comment on function public.f(uuid) is 'x'")).toEqual([
      { kind: "function", schema: "public", name: "f", args: "uuid" },
    ]);
  });

  test("grants and revokes, one target per object, role and privilege", () => {
    expect(targets("grant select, insert on table public.t to anon, service_role")).toEqual([
      { kind: "grant", on: "table", schema: "public", name: "t", role: "anon", privilege: "select" },
      { kind: "grant", on: "table", schema: "public", name: "t", role: "anon", privilege: "insert" },
      { kind: "grant", on: "table", schema: "public", name: "t", role: "service_role", privilege: "select" },
      { kind: "grant", on: "table", schema: "public", name: "t", role: "service_role", privilege: "insert" },
    ]);
    expect(targets("grant all on function public.f(cellar uuid) to authenticated")).toEqual([
      { kind: "grant", on: "function", schema: "public", name: "f", args: "uuid", role: "authenticated", privilege: "all" },
    ]);
    expect(targets("revoke all on function public.f(uuid) from public")).toEqual([
      { kind: "grant", on: "function", schema: "public", name: "f", args: "uuid", role: "public", privilege: "all" },
    ]);
    expect(targets("grant usage on schema s to anon")).toEqual([
      { kind: "grant", on: "schema", schema: "s", name: "s", role: "anon", privilege: "usage" },
    ]);
    expect(targets("grant all on sequence public.q to anon")).toEqual([
      { kind: "grant", on: "sequence", schema: "public", name: "q", role: "anon", privilege: "all" },
    ]);
  });

  test("default privileges", () => {
    expect(targets("alter default privileges for role postgres in schema public grant all on tables to anon")).toEqual([
      { kind: "default-privilege", schema: "public", name: "tables", role: "anon", privilege: "all" },
    ]);
    expect(
      targets("alter default privileges in schema public grant execute on functions to authenticated"),
    ).toEqual([{ kind: "default-privilege", schema: "public", name: "functions", role: "authenticated", privilege: "execute" }]);
  });

  test("sequences, data and session settings", () => {
    expect(targets("create sequence public.s")).toEqual([{ kind: "sequence", schema: "public", name: "s" }]);
    expect(targets("alter sequence public.s owned by public.t.id")).toEqual([
      { kind: "sequence", schema: "public", name: "s" },
    ]);
    expect(targets("select pg_catalog.setval('public.bottles_id_seq', 5, true)")).toEqual([
      { kind: "sequence", schema: "public", name: "bottles_id_seq" },
    ]);
    expect(targets(`select pg_catalog.setval('public."odd.name_seq"', 5, true)`)).toEqual([
      { kind: "sequence", schema: "public", name: "odd.name_seq" },
    ]);
    expect(targets("insert into public.t (id) values (1)")).toEqual([{ kind: "data", schema: "public", table: "t" }]);
    expect(targets("set check_function_bodies = false")).toEqual([{ kind: "session" }]);
    expect(targets("select pg_catalog.set_config('search_path', '', false)")).toEqual([{ kind: "session" }]);
    expect(targets("select 1")).toEqual([]);
    expect(targets("create type public.ty as enum ('a')")).toEqual([]);
  });

  test("hostile names come through as they are", () => {
    expect(targets(`create table public."<script>x</script>" ("line\nbreak" text)`)).toContainEqual({
      kind: "column",
      schema: "public",
      table: "<script>x</script>",
      name: "line\nbreak",
    });
  });
});

describe("normalizeArgs", () => {
  test("reduces named and unnamed argument lists to the same signature", () => {
    expect(normalizeArgs("cellar uuid, bottle_name text, bottle_vintage integer")).toBe("uuid,text,int4");
    expect(normalizeArgs("uuid, text, int4")).toBe("uuid,text,int4");
    expect(normalizeArgs("")).toBe("");
    expect(normalizeArgs("text, text")).toBe("text,text");
  });
});

// --- a tiny synthetic manifest -------------------------------------------------------------------------

const entry = (
  id: string,
  kind: "tie" | "control",
  mode: OracleEntry["mode"],
  ...objects: Record<string, string>[]
): Record<string, unknown> => ({
  id,
  kind,
  location: { database: objects },
  oracle: mode.startsWith("probe-") ? { mode, probe: "select 1" } : { mode },
});

// A load-fails entry that declares the platform names its failure must name.
const failing = (
  id: string,
  kind: "tie" | "control",
  failsOn: string[],
  ...objects: Record<string, string>[]
): Record<string, unknown> => ({
  id,
  kind,
  location: { database: objects },
  oracle: { mode: "load-fails", fails_on: failsOn },
});

// The roles the synthetic dump names that stock lacks.
const ROLES = ["anon", "authenticated", "service_role"];

const ENTRIES = oracleEntries([
  failing("tie-default", "tie", ["auth"], { object: "column-default", schema: "public", table: "t", name: "who" }),
  entry("control-check", "control", "probe-same", { object: "constraint", schema: "public", table: "t", name: "ok_c" }),
  entry("control-rls", "control", "probe-same", { object: "rls", schema: "public", table: "t" }),
  entry("control-table", "control", "probe-same", { object: "table", schema: "public", name: "u" }),
  failing("tie-policy", "tie", ["authenticated"], { object: "policy", schema: "public", table: "u", name: "p" }),
  entry("tie-function", "tie", "probe-differs", { object: "function", schema: "public", name: "f", args: "cellar uuid" }),
  entry("tie-extension", "tie", "not-in-dump", { object: "extension", name: "vector", schema: "extensions" }),
  entry("control-server", "control", "probe-same", { object: "foreign-server", name: "srv" }, {
    object: "foreign-table",
    schema: "public",
    name: "ft",
  }),
  entry("control-comment", "control", "probe-same", { object: "comment", schema: "public", table: "u", column: "id" }),
  entry("control-column", "control", "probe-same", { object: "column", schema: "public", table: "u", name: "x" }),
  failing("control-names-role", "control", ["anon"], {
    object: "policy",
    schema: "public",
    table: "u",
    name: "q",
  }),
  failing(
    "tie-default-privileges",
    "tie",
    ["authenticated"],
    { object: "default-privilege", schema: "public", name: "tables", role: "authenticated", privilege: "select" },
  ),
  failing("tie-grant", "tie", ["authenticated"], {
    object: "grant",
    on: "function",
    schema: "public",
    name: "f",
    role: "authenticated",
    privilege: "execute",
    args: "cellar uuid",
  }),
]);

const SQL = [
  /* 0 */ "create table public.t (id int, who uuid default auth.uid(), constraint ok_c check (id > 0))",
  /* 1 */ "alter table public.t enable row level security",
  /* 2 */ "create table public.u (id int)",
  /* 3 */ "create policy p on public.u to authenticated using (true)",
  /* 4 */ "create function public.f(cellar uuid) returns int language sql as 'select 1'",
  /* 5 */ "alter table public.u add column x int",
  /* 6 */ "create foreign table public.ft (id int) server srv",
  /* 7 */ "comment on column public.u.id is 'x'",
  /* 8 */ "create policy q on public.u to anon using (true)",
  /* 9 */ "alter default privileges in schema public grant all on tables to authenticated",
  /* 10 */ "grant all on function public.f(cellar uuid) to authenticated",
  /* 11 */ "grant all on table public.u to service_role",
  /* 12 */ "alter table public.t owner to postgres",
].join(";\n");

const fail = (sqlstate: string, message: string): Outcome => ({ ok: false, sqlstate, message });
const OK: Outcome = { ok: true };

function run(outcomes: Outcome[], entries = ENTRIES, sql = SQL, roles: readonly string[] = ROLES) {
  const statements = splitDump(sql);
  return judge(
    statements.map((statement, index) => ({ statement, outcome: outcomes[index] ?? OK })),
    entries,
    roles,
  );
}

const statusOf = (judgement: Judgement, id: string): Status | undefined =>
  judgement.entries.find((one) => one.id === id)?.status;

const passOf = (judgement: Judgement, id: string): PassResult => {
  const found = judgement.entries.find((one) => one.id === id);
  return { status: found?.status ?? "absent", named: found?.named ?? [] };
};

const entryOf = (id: string, entries = ENTRIES): OracleEntry => {
  const found = entries.find((one) => one.id === id);
  if (found === undefined) throw new Error(`no entry ${id}`);
  return found;
};

describe("attribute", () => {
  const statements = splitDump(SQL);
  const { byEntry, byStatement } = attribute(statements, ENTRIES);

  test("maps statements to the entries whose objects they create or alter", () => {
    expect(byEntry.get("tie-default")).toEqual([0]);
    expect(byEntry.get("control-check")).toEqual([0]);
    expect(byEntry.get("control-rls")).toEqual([1]);
    expect(byEntry.get("control-table")).toEqual([2]);
    expect(byEntry.get("tie-policy")).toEqual([3]);
    expect(byEntry.get("control-column")).toEqual([5]);
    expect(byEntry.get("control-comment")).toEqual([7]);
    expect(byEntry.get("tie-extension")).toEqual([]);
    expect(byStatement.get(12)).toEqual([]);
  });

  test("matches a function by name and argument types, whatever the argument names", () => {
    expect(byEntry.get("tie-function")).toEqual([4]);
  });

  test("matches a grant by object, role and privilege; all covers any privilege", () => {
    expect(byEntry.get("tie-grant")).toEqual([10]);
    expect(byEntry.get("tie-default-privileges")).toEqual([9]);
    expect(byStatement.get(11)).toEqual([]);
  });

  test("tells a column comment from a table comment", () => {
    const { byEntry: other } = attribute(splitDump("comment on table public.u is 'x'"), ENTRIES);
    expect(other.get("control-comment")).toEqual([]);
  });
});

describe("judge", () => {
  const missingAuth = fail("3F000", 'schema "auth" does not exist');
  const missingTable = fail("42P01", 'relation "public.t" does not exist');
  const missingRole = fail("42704", 'role "authenticated" does not exist');

  test("a platform reference fails the tie; a control in the same statement is a cascade", () => {
    const judgement = run([missingAuth]);
    expect(statusOf(judgement, "tie-default")).toBe("failed");
    expect(statusOf(judgement, "control-check")).toBe("cascade");
    expect(judgement.entries.find((one) => one.id === "tie-default")?.sqlstates).toEqual(["3F000"]);
  });

  test("a failure naming an object whose creation failed is a cascade, not a failure of its own", () => {
    const judgement = run([missingAuth, missingTable]);
    expect(statusOf(judgement, "control-rls")).toBe("cascade");
    expect(judgement.unexplained).toEqual([]);
    expect(judgement.unattributed).toEqual([]);
  });

  test("a tie whose only failure is a cascade is recorded as a cascade", () => {
    const cascadingPolicy = fail("42P01", 'relation "public.u" does not exist');
    const judgement = run([OK, OK, fail("42601", "x"), cascadingPolicy]);
    expect(statusOf(judgement, "tie-policy")).toBe("cascade");
  });

  test("a role the stock database lacks fails the policy that names it", () => {
    const judgement = run([OK, OK, OK, missingRole]);
    expect(statusOf(judgement, "tie-policy")).toBe("failed");
    expect(statusOf(judgement, "control-table")).toBe("loaded");
  });

  test("a control that declares load-fails owns a platform failure no tie explains", () => {
    const judgement = run([OK, OK, OK, OK, OK, OK, OK, OK, fail("42704", 'role "anon" does not exist')]);
    expect(statusOf(judgement, "control-names-role")).toBe("failed");
    expect(judgement.unattributed).toEqual([]);
  });

  test("a grant to a platform role no entry owns goes to the platform ACL, and no entry is credited", () => {
    const role = fail("42704", 'role "service_role" does not exist');
    const judgement = run([OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, role]);
    expect(judgement.platformAcl).toEqual([{ index: 11, sqlstate: "42704" }]);
    expect(statusOf(judgement, "tie-default-privileges")).toBe("loaded");
    expect(statusOf(judgement, "control-table")).toBe("loaded");
    expect(judgement.unattributed).toEqual([]);
    expect(judgement.unexplained).toEqual([]);
  });

  test("an entry whose own statement loads is a mismatch even when other grants fail", () => {
    const failed = fail("42704", 'role "authenticated" does not exist');
    const judgement = run([OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, failed, failed]);
    // statement 9 (the default privilege entry's own) loaded; 10 is the grant entry's own, 11 is no one's
    expect(passOf(judgement, "tie-default-privileges").status).toBe("loaded");
    expect(verdictOf(entryOf("tie-default-privileges"), { bare: passOf(judgement, "tie-default-privileges"), roles: passOf(judgement, "tie-default-privileges") })).toBe("mismatch");
    expect(passOf(judgement, "tie-grant")).toEqual({ status: "failed", named: ["authenticated"] });
    expect(judgement.platformAcl).toEqual([{ index: 11, sqlstate: "42704" }]);
  });

  test("a failure on a platform role in a statement an entry owns is that entry's, not the platform ACL's", () => {
    const failed = fail("42704", 'role "authenticated" does not exist');
    const judgement = run([OK, OK, OK, OK, OK, OK, OK, OK, OK, failed]);
    expect(passOf(judgement, "tie-default-privileges")).toEqual({ status: "failed", named: ["authenticated"] });
    expect(judgement.platformAcl).toEqual([]);
  });

  test("a grant failing on something other than a role is unattributed, not platform ACL", () => {
    const judgement = run([OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, fail("3F000", 'schema "auth" does not exist')]);
    expect(judgement.platformAcl).toEqual([]);
    expect(judgement.unattributed).toEqual([{ index: 11, sqlstate: "3F000" }]);
  });

  test("a platform failure in a statement no entry owns, and not a grant, is unattributed", () => {
    const judgement = run([OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, fail("3F000", 'schema "auth" does not exist')]);
    expect(judgement.unattributed).toEqual([{ index: 12, sqlstate: "3F000" }]);
    expect(judgement.platformAcl).toEqual([]);
  });

  test("a failure no rule explains is unexplained", () => {
    const judgement = run([OK, OK, OK, OK, OK, fail("XX000", "something odd happened")]);
    expect(statusOf(judgement, "control-column")).toBe("unexplained");
    expect(judgement.unexplained).toEqual([{ index: 5, sqlstate: "XX000" }]);
  });

  test("a failure naming an object a dump never holds is a cascade", () => {
    const judgement = run([OK, OK, OK, OK, OK, OK, fail("42704", 'server "srv" does not exist')]);
    expect(statusOf(judgement, "control-server")).toBe("cascade");
    expect(judgement.unexplained).toEqual([]);
  });

  test("an entry no statement targets is absent; one whose statements all ran is loaded", () => {
    const judgement = run([]);
    expect(statusOf(judgement, "tie-extension")).toBe("absent");
    expect(statusOf(judgement, "control-table")).toBe("loaded");
    expect(statusOf(judgement, "tie-function")).toBe("loaded");
  });

  test("a failed status outranks a cascade on the same entry", () => {
    const entries = oracleEntries([
      entry(
        "both",
        "tie",
        "load-fails",
        { object: "rls", schema: "public", table: "t" },
        { object: "column-default", schema: "public", table: "t", name: "who" },
      ),
    ]);
    expect(statusOf(run([missingAuth, missingTable], entries), "both")).toBe("failed");
  });

  test("a platform word inside a longer name is not a platform reference", () => {
    const judgement = run([OK, OK, OK, OK, OK, fail("42601", 'syntax error at or near "auth_audit"')]);
    expect(judgement.unexplained).toEqual([{ index: 5, sqlstate: "42601" }]);
  });

  test("a failure names a failed object as a whole identifier: a short name is not inside a longer one", () => {
    const tt = fail("42P01", 'relation "public.tt" does not exist');
    // statement 0 creates public.t and fails; a later failure naming public.tt is not a cascade of it
    const judgement = run([missingAuth, OK, OK, OK, OK, tt]);
    expect(statusOf(judgement, "control-column")).toBe("unexplained");
    expect(judgement.unexplained).toEqual([{ index: 5, sqlstate: "42P01" }]);
    const t = fail("42P01", 'relation "public.t" does not exist');
    expect(statusOf(run([missingAuth, OK, OK, OK, OK, t]), "control-column")).toBe("cascade");
  });
});

describe("what a failure must name", () => {
  const roleless = fail("42704", 'role "authenticated" does not exist');
  const noAuth = fail("3F000", 'schema "auth" does not exist');
  const noExtensions = fail("3F000", 'schema "extensions" does not exist');
  const mixed = oracleEntries([
    failing("tie-mixed", "tie", ["authenticated", "auth"], { object: "policy", schema: "public", table: "u", name: "p" }),
  ]);
  const verdict = (bare: Judgement, roles: Judgement, entries = mixed) =>
    verdictOf(entryOf(entries[0]?.id ?? "", entries), {
      bare: passOf(bare, entries[0]?.id ?? ""),
      roles: passOf(roles, entries[0]?.id ?? ""),
    });
  const policy = [OK, OK, OK];

  test("a missing role does not stand in for a missing schema: the roles pass must fail on the schema", () => {
    const bare = run([...policy, roleless], mixed);
    expect(passOf(bare, "tie-mixed")).toEqual({ status: "failed", named: ["authenticated"] });
    expect(verdict(bare, run([...policy, OK], mixed))).toBe("mismatch");
    expect(verdict(bare, run([...policy, roleless], mixed))).toBe("mismatch");
    expect(verdict(bare, run([...policy, noAuth], mixed))).toBe("proof");
  });

  test("a role-only entry is judged on the bare pass alone", () => {
    const roleOnly = oracleEntries([
      failing("tie-roles", "tie", ["authenticated"], { object: "policy", schema: "public", table: "u", name: "p" }),
    ]);
    const bare = run([...policy, roleless], roleOnly);
    expect(verdict(bare, run([...policy, OK], roleOnly), roleOnly)).toBe("proof");
  });

  test("another platform schema's failure does not prove an entry that declares auth", () => {
    const authOnly = oracleEntries([
      failing("tie-auth", "tie", ["auth"], { object: "column-default", schema: "public", table: "t", name: "who" }),
    ]);
    const masked = run([noExtensions], authOnly);
    expect(passOf(masked, "tie-auth")).toEqual({ status: "failed", named: [] });
    expect(verdict(masked, masked, authOnly)).toBe("mismatch");
    const proven = run([noAuth], authOnly);
    expect(verdict(proven, proven, authOnly)).toBe("proof");
  });

  test("a name inside a longer identifier is not named", () => {
    const authOnly = oracleEntries([
      failing("tie-auth", "tie", ["auth"], { object: "column-default", schema: "public", table: "t", name: "who" }),
    ]);
    const both = run([fail("3F000", 'schema "extensions" does not exist for "auth_audit.x"')], authOnly);
    expect(passOf(both, "tie-auth").named).toEqual([]);
  });

  test("a failure that is a cascade of an earlier object stays a cascade, in either pass", () => {
    const gone = fail("42P01", 'relation "public.t" does not exist');
    const bare = run([noAuth, OK, OK, OK, OK, OK, OK, OK, OK, OK, OK, OK], mixed);
    expect(statusOf(bare, "tie-mixed")).toBe("loaded");
    const cascaded = run([noAuth, OK, OK, gone], mixed);
    expect(passOf(cascaded, "tie-mixed").status).toBe("cascade");
    expect(verdict(cascaded, cascaded)).toBe("cascade");
    expect(verdict(run([...policy, roleless], mixed), cascaded)).toBe("cascade");
  });
});

describe("identifiersIn", () => {
  test("names whole identifiers, quoted or bare, with their qualified form", () => {
    const found = identifiersIn('relation "public.t" does not exist, function auth.uid() and "it""s" and "a.b".c');
    for (const name of ["public", "t", "public.t", "auth", "uid", "auth.uid", 'it"s', "a", "b", "c"]) {
      expect(found.has(name), name).toBe(true);
    }
    for (const name of ["pub", "au", "u", "relation x"]) expect(found.has(name), name).toBe(false);
  });

  test("does not find a name inside a longer one", () => {
    const found = identifiersIn('syntax error at or near "auth_audit" and "unauthorized"');
    expect(found.has("auth")).toBe(false);
    expect(found.has("auth_audit")).toBe(true);
  });
});

describe("rolesOf", () => {
  test("lists every role a statement names, from its parse tree, and no pseudo-role", () => {
    const statements = splitDump(`
      grant select on table public.t to anon, authenticated, public;
      create policy p on public.t for select to service_role, current_user using (true);
      alter default privileges for role supabase_admin in schema public grant all on tables to anon;
      alter table public.t owner to postgres;
      select 1;`);
    expect(rolesOf(statements)).toEqual(["anon", "authenticated", "postgres", "service_role", "supabase_admin"]);
  });
});

describe("verdictOf", () => {
  const modeOf = (mode: OracleEntry["mode"], failsOn: string[] = []): OracleEntry => ({
    id: "x",
    kind: "tie",
    mode,
    probe: "",
    failsOn,
    objects: [],
    postgresMajor: undefined,
  });
  const at = (status: Status, ...named: string[]): PassResult => ({ status, named });
  const same = (pass: PassResult) => ({ bare: pass, roles: pass });

  test("load-fails: an own failure naming a declared name is proof, a cascade is listed, anything else is a mismatch", () => {
    const entry = modeOf("load-fails", ["anon"]);
    expect(verdictOf(entry, same(at("failed", "anon")))).toBe("proof");
    expect(verdictOf(entry, same(at("failed")))).toBe("mismatch");
    expect(verdictOf(entry, same(at("cascade")))).toBe("cascade");
    for (const status of ["loaded", "absent", "unexplained"] as const) {
      expect(verdictOf(entry, same(at(status)))).toBe("mismatch");
    }
    expect(verdictOf(modeOf("load-fails"), same(at("failed", "anon")))).toBe("mismatch");
  });

  test("load-fails with a schema name: the roles pass must fail naming a schema too", () => {
    const entry = modeOf("load-fails", ["authenticated", "auth"]);
    const bare = at("failed", "authenticated");
    expect(verdictOf(entry, { bare, roles: at("failed", "auth") })).toBe("proof");
    expect(verdictOf(entry, { bare, roles: at("failed", "authenticated") })).toBe("mismatch");
    expect(verdictOf(entry, { bare, roles: at("loaded") })).toBe("mismatch");
    expect(verdictOf(entry, { bare, roles: at("cascade") })).toBe("cascade");
    expect(verdictOf(entry, { bare: at("failed"), roles: at("failed", "auth") })).toBe("mismatch");
    expect(verdictOf(entry, { bare: at("cascade"), roles: at("failed", "auth") })).toBe("cascade");
  });

  test("probe-same: loaded with equal rows is proof, a cascade is listed, the rest is a mismatch", () => {
    const loaded = same(at("loaded"));
    expect(verdictOf(modeOf("probe-same"), loaded, "same")).toBe("proof");
    expect(verdictOf(modeOf("probe-same"), same(at("cascade")))).toBe("cascade");
    expect(verdictOf(modeOf("probe-same"), loaded, "differs")).toBe("mismatch");
    expect(verdictOf(modeOf("probe-same"), loaded)).toBe("mismatch");
    expect(verdictOf(modeOf("probe-same"), same(at("failed")))).toBe("mismatch");
  });

  test("probe-differs: loaded with different outcomes is proof; a cascade is not", () => {
    const loaded = same(at("loaded"));
    expect(verdictOf(modeOf("probe-differs"), loaded, "differs")).toBe("proof");
    expect(verdictOf(modeOf("probe-differs"), loaded, "same")).toBe("mismatch");
    expect(verdictOf(modeOf("probe-differs"), same(at("cascade")))).toBe("mismatch");
    expect(verdictOf(modeOf("probe-differs"), same(at("failed")), "differs")).toBe("mismatch");
  });

  test("not-in-dump: absent is excluded from the claim; anything in the dump is a mismatch", () => {
    expect(verdictOf(modeOf("not-in-dump"), same(at("absent")))).toBe("excluded");
    expect(verdictOf(modeOf("not-in-dump"), same(at("loaded")))).toBe("mismatch");
    expect(verdictOf(modeOf("not-in-dump"), same(at("cascade")))).toBe("mismatch");
  });
});

describe("oracleEntries", () => {
  test("keeps database entries with a valid oracle and normalises their arguments", () => {
    const found = oracleEntries([
      { id: "code.x", location: { file: "a", symbol: "b" } },
      { id: "db.bad", kind: "tie", location: { database: [] }, oracle: { mode: "load-fails" } },
      { id: "db.odd", kind: "tie", location: { database: [{ object: "table", schema: "s", name: "n" }] }, oracle: { mode: "other" } },
      { id: "db.ok", kind: "control", postgres_major: 15, location: { database: [{ object: "function", schema: "s", name: "f", args: "a uuid" }] }, oracle: { mode: "probe-same", probe: "select 1" } },
      { id: "db.fails", kind: "tie", location: { database: [{ object: "table", schema: "s", name: "n" }] }, oracle: { mode: "load-fails", fails_on: ["auth", 7, "anon"] } },
    ]);
    expect(found).toEqual([
      {
        id: "db.ok",
        kind: "control",
        mode: "probe-same",
        probe: "select 1",
        failsOn: [],
        objects: [{ kind: "function", schema: "s", name: "f", args: "uuid" }],
        postgresMajor: 15,
      },
      {
        id: "db.fails",
        kind: "tie",
        mode: "load-fails",
        probe: "",
        failsOn: ["auth", "anon"],
        objects: [{ kind: "table", schema: "s", name: "n" }],
        postgresMajor: undefined,
      },
    ]);
  });
});

describe("the load script and its output", () => {
  const marker = "testmarker";
  const statements = splitDump("select 1;\ncreate table public.t (id int);");

  test("sends each statement as written, one savepoint each, between BEGIN and COMMIT", () => {
    const script = buildLoadScript(statements, marker);
    expect(script).toContain("\\set ON_ERROR_ROLLBACK on");
    expect(script).toContain("BEGIN;\nselect 1;\n\\if :ERROR");
    expect(script).toContain("create table public.t (id int);\n\\if :ERROR");
    expect(script).toContain(`\\echo NW${marker} 1 err :LAST_ERROR_SQLSTATE`);
    expect(script.trimEnd().endsWith(`COMMIT;\n\\echo NW${marker} done`)).toBe(true);
  });

  test("reads ok and error lines, with the message quoted by psql", () => {
    const stdout = [
      `NW${marker} 0 ok`,
      `NW${marker} 1 err 42P01`,
      ` E'relation "it''s`,
      `a \\\\ b" does not exist'`,
      `NW${marker} 1 end`,
      `NW${marker} done`,
      "",
    ].join("\n");
    expect(parseLoadOutput(stdout, marker, 2)).toEqual([
      { ok: true },
      { ok: false, sqlstate: "42P01", message: `relation "it's\na \\ b" does not exist` },
    ]);
  });

  test("a message cannot forge a marker: only lines with this run's marker count", () => {
    const stdout = [
      `NW${marker} 0 err 42P01`,
      ` 'NWdeadbeef 1 ok`,
      `NW${marker.slice(1)} 1 ok'`,
      `NW${marker} 0 end`,
      `NW${marker} 1 ok`,
      `NW${marker} done`,
    ].join("\n");
    const outcomes = parseLoadOutput(stdout, marker, 2);
    expect(outcomes).toHaveLength(2);
    expect(outcomes[0]?.ok).toBe(false);
  });

  test("throws when the output is incomplete or out of step", () => {
    expect(() => parseLoadOutput(`NW${marker} 0 ok\n`, marker, 2)).toThrow();
    expect(() => parseLoadOutput(`NW${marker} 1 ok\nNW${marker} done\n`, marker, 1)).toThrow();
    expect(() => parseLoadOutput(`NW${marker} 0 ok\n`, marker, 1)).toThrow();
  });
});

describe("summarize", () => {
  test("counts verdicts and statuses and lists the cascades and the excluded entries by id", () => {
    const lines = summarize(
      [
        { id: "a", mode: "load-fails", status: "failed", sqlstates: ["42704"], verdict: "proof" },
        { id: "b", mode: "probe-same", status: "cascade", sqlstates: ["42P01"], verdict: "cascade" },
        { id: "c", mode: "not-in-dump", status: "absent", sqlstates: [], verdict: "excluded" },
      ],
      [{ index: 7, sqlstate: "42704" }],
    );
    expect(lines).toEqual([
      "oracle: 3 entries",
      "verdicts: proof 1, cascade 1, excluded 1",
      "statuses: failed 1, cascade 1, absent 1",
      "cascade (recorded, not proof): b",
      "not-in-dump (excluded from the claim): c",
      "platform ACL (grants to platform roles that no entry lists; not proof): 1 statements: 7:42704",
    ]);
  });
});
