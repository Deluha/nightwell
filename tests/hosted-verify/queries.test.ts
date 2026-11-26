// The hosted verification queries are reviewed like code. This test parses each one with a real
// PostgreSQL parser and holds it to the lists in the checker. It keeps the queries' shape; it does
// not prove what a query returns, which is why a change to a query or to a list needs review.
import { readdirSync, readFileSync } from "node:fs";
import { loadModule, parseSync } from "libpg-query";
import { beforeAll, describe, expect, test } from "vitest";
import { checkHostedQuery } from "../../scripts/checkers/hosted-queries.ts";

const DIR = "scripts/hosted-verify";
const files = readdirSync(DIR).filter((file) => file.endsWith(".sql"));
const check = (sql: string) =>
  checkHostedQuery("q.sql", parseSync(sql)).map((problem) => problem.message);

beforeAll(async () => {
  await loadModule();
});

test("the directory holds only the queries", () => {
  expect(files.length).toBeGreaterThan(0);
  expect(readdirSync(DIR)).toEqual(files);
});

describe.each(files)("%s", (file) => {
  test("starts with a header comment and passes the checker", () => {
    const text = readFileSync(`${DIR}/${file}`, "utf8");
    expect(text).toMatch(/^-- (U\d|Context)/);
    expect(checkHostedQuery(file, parseSync(text))).toEqual([]);
  });
});

describe("the checker", () => {
  test("accepts a catalog query", () => {
    expect(
      check("select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on true"),
    ).toEqual([]);
  });

  test("requires exactly one SELECT", () => {
    const one = ["must be exactly one SELECT statement"];
    expect(check("select 1; select 2")).toEqual(one);
    expect(check("delete from pg_catalog.pg_class")).toEqual(one);
    expect(check("set role postgres")).toEqual(one);
  });

  test.each([
    ["a comma join", "select 1 from pg_catalog.pg_class c, public.customers u"],
    ["a quoted relation", 'select 1 from pg_catalog.pg_class c join "auth"."users" u on true'],
    ["a spaced qualified name", "select 1 from auth . users"],
    ["an unqualified relation", "select 1 from pg_catalog.pg_class c join customers u on true"],
    ["a digit in the schema name", "select 1 from app1.orders"],
    ["a subquery", "select exists (select 1 from storage.objects)"],
    ["a sensitive catalog", "select rolname from pg_catalog.pg_authid"],
  ])("rejects a relation off the list: %s", (_name, sql) => {
    expect(check(sql).join()).toMatch(/not on the relation list/);
  });

  test.each([
    [
      "a query runner",
      "select pg_catalog.query_to_xml('select 1 from auth.users', true, true, '')",
    ],
    ["a definition function", "select pg_get_viewdef(oid) from pg_catalog.pg_class"],
    ["a side effect", "select pg_notify('a', 'b')"],
    ["a function in another schema", "select public.count(1)"],
  ])("rejects a function off the list: %s", (_name, sql) => {
    expect(check(sql).join()).toMatch(/not on the function list/);
  });

  test.each([
    ["a user-defined operator", "select 1 operator(public.+) 2", /not a built-in operator/],
    [
      "a user-defined sort operator",
      "select 1 from pg_catalog.pg_class order by oid using operator(public.<)",
      /not a built-in operator/,
    ],
    ["a user-defined type", "select 'x'::public.evil", /not on the type list/],
    ["a cast to a name-resolving type", "select 'auth.users'::regclass", /not on the type list/],
    [
      "a sampling method",
      "select 1 from pg_catalog.pg_class tablesample public.evil (10)",
      /forbidden construct/,
    ],
    ["another value function", "select session_user", /not on the value-function list/],
  ])("rejects code that runs through another node kind: %s", (_name, sql, expected) => {
    expect(check(sql).join()).toMatch(expected);
  });

  test("accepts the built-in forms the queries use", () => {
    expect(check("select current_user, count(*)::text || 'x' from pg_catalog.pg_roles")).toEqual(
      [],
    );
  });

  test("the two role queries name the same fixed list of platform roles", () => {
    const list = (file: string) =>
      [
        ...readFileSync(`${DIR}/${file}`, "utf8").matchAll(
          /'((?:supabase_|anon|auth|service|postgres|dashboard|pgbouncer)\w*)'/g,
        ),
      ]
        .map((match) => match[1])
        .sort();
    expect(list("u8-connecting-role.sql")).toEqual(list("u8-platform-roles.sql"));
    expect(list("u8-platform-roles.sql").length).toBeGreaterThan(10);
  });

  test("rejects writes, INTO, locking clauses and other settings", () => {
    expect(
      check(
        "with w as (insert into pg_catalog.pg_class default values returning 1) select 1",
      ).join(),
    ).toMatch(/forbidden construct/);
    expect(check("select 1 into t from pg_catalog.pg_class").join()).toMatch(/INTO/);
    expect(check("select 1 from pg_catalog.pg_class for update").join()).toMatch(/locking clause/);
    expect(check("select current_setting('pgrst.db_schemas')")).toEqual([
      "reads a setting that is not on the setting list",
    ]);
    expect(check("select current_setting(relname) from pg_catalog.pg_class")).toHaveLength(1);
  });
});
