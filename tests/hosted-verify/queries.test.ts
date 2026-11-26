// The hosted verification queries are reviewed like code. This test keeps their shape: one SELECT
// each, no write, and no relation outside the system catalogs and information_schema.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const DIR = "scripts/hosted-verify";
const files = readdirSync(DIR).filter((file) => file.endsWith(".sql"));
const FORBIDDEN =
  /\b(insert|update|delete|merge|truncate|create|alter|drop|grant|revoke|copy|call|do|set|reset|lock|vacuum|analyze|refresh|listen|notify|execute|prepare|into|nextval|setval|set_config|pg_sleep|dblink\w*|lo_\w+|pg_read_\w+|pg_ls_\w+|pg_terminate_backend|pg_cancel_backend|pg_notify|pg_advisory\w*)\b/i;
const NEVER_READ =
  /\b(auth\.users|storage\.objects|vault\.\w+|cron\.job\w*|supabase_functions\.hooks|net\.\w+)\b/i;

function sql(file: string): string {
  return readFileSync(`${DIR}/${file}`, "utf8")
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .replace(/'(?:[^']|'')*'/g, "''");
}

test("the directory holds the queries", () => {
  expect(files.length).toBeGreaterThan(0);
});

describe.each(files)("%s", (file) => {
  const text = sql(file);

  test("is a single SELECT with a header comment", () => {
    expect(readFileSync(`${DIR}/${file}`, "utf8")).toMatch(/^-- U\d|^-- Context/);
    expect(text.trim()).toMatch(/^select\b/i);
    expect(text).not.toContain(";");
  });

  test("contains no write, no side-effect function and no never-read relation", () => {
    expect(text).not.toMatch(FORBIDDEN);
    expect(text).not.toMatch(NEVER_READ);
  });

  test("reads only system catalogs and information_schema", () => {
    const relations = [
      ...text.matchAll(/\b(?:from|join)\s+(?:lateral\s+)?([a-z_]+\.[a-z_]+)/gi),
    ].map((match) => match[1] ?? "");
    expect(relations.length).toBeGreaterThan(0);
    for (const relation of relations) {
      expect(relation).toMatch(/^(pg_catalog|information_schema)\./);
    }
  });
});
