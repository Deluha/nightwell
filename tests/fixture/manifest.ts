// Shared by the offline and live manifest tests: reads fixture/manifest.yaml and holds the closed list
// of database object kinds, each with the fields it must carry. One home for both (R6).
import { readFileSync } from "node:fs";
import { parse } from "yaml";

export const MANIFEST_PATH = "fixture/manifest.yaml";

export const OBJECT_FIELDS = {
  schema: ["name"],
  table: ["schema", "name"],
  column: ["schema", "table", "name"],
  "column-default": ["schema", "table", "name"],
  constraint: ["schema", "table", "name"],
  index: ["schema", "name"],
  policy: ["schema", "table", "name"],
  rls: ["schema", "table"],
  function: ["schema", "name", "args"],
  trigger: ["schema", "table", "name"],
  view: ["schema", "name"],
  "materialized-view": ["schema", "name"],
  grant: ["on", "schema", "name", "role", "privilege"],
  "default-privilege": ["schema", "name", "role", "privilege"],
  extension: ["name"],
  publication: ["name"],
  "publication-table": ["name", "schema", "table"],
  "replica-identity": ["schema", "table", "setting"],
  "role-setting": ["role", "setting"],
  "cron-job": ["name"],
  "vault-secret": ["name"],
  queue: ["name"],
  "foreign-server": ["name"],
  "user-mapping": ["name", "role"],
  "foreign-table": ["schema", "name"],
  bucket: ["name"],
  comment: ["schema", "table"],
  operator: ["schema", "name", "args"],
} as const satisfies Record<string, readonly string[]>;

export type ObjectKind = keyof typeof OBJECT_FIELDS;

// Every field an object may carry. `on` says what a grant is on: table, function or schema.
export const OBJECT_KEYS = [
  "object",
  "schema",
  "name",
  "table",
  "column",
  "role",
  "args",
  "setting",
  "privilege",
  "on",
] as const;

export type Row = Record<string, unknown>;

export const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isObjectKind = (value: unknown): value is ObjectKind =>
  typeof value === "string" && Object.hasOwn(OBJECT_FIELDS, value);

export function loadManifest(): Row {
  const parsed: unknown = parse(readFileSync(MANIFEST_PATH, "utf8"));
  if (!isRow(parsed)) throw new Error("the manifest is not a mapping");
  return parsed;
}

export const manifestEntries = (): Row[] => {
  const entries = loadManifest()["entries"];
  return Array.isArray(entries) ? entries.filter(isRow) : [];
};
