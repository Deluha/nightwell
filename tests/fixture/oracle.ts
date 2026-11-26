// The oracle's logic, shared by its offline and live tests. Pure: no file, process or network access.
// The oracle dumps the fixture's non-managed schemas, loads the dump into stock PostgreSQL statement by
// statement, twice (`bare`, and `roles` with the platform's roles added as plain stand-ins), and holds each
// manifest entry to its declared oracle mode. This file splits the dump, says which manifest objects each
// statement creates or alters, builds the psql script and reads its output, and judges the outcome. The
// live test (oracle.live.test.ts) does the running.
import { parseSync } from "libpg-query";
import {
  isObjectKind,
  isOracleMode,
  isRow,
  OBJECT_KEYS,
  type ObjectKind,
  type OracleMode,
  type Row,
} from "./manifest.ts";

// The schemas the platform manages, left out of the dump. This is the Supabase CLI's internal-schema list
// (`INTERNAL_SCHEMAS` in supabase/cli `apps/cli/src/commands/inspect/db/inspect-schemas.ts`, tag v3.4.0),
// which already holds `_realtime`, `pgbouncer`, `information_schema` and `pg_*`. A trailing `*` is a prefix
// pattern. Every other schema is dumped.
export const MANAGED_SCHEMAS: readonly string[] = [
  "information_schema",
  "pg_*",
  "_analytics",
  "_realtime",
  "_supavisor",
  "auth",
  "etl",
  "extensions",
  "pgbouncer",
  "realtime",
  "storage",
  "supabase_functions",
  "supabase_migrations",
  "cron",
  "dbdev",
  "graphql",
  "graphql_public",
  "net",
  "pgmq",
  "pgsodium",
  "pgsodium_masks",
  "pgtle",
  "repack",
  "tiger",
  "tiger_data",
  "timescaledb_*",
  "_timescaledb_*",
  "topology",
  "vault",
];

export const isManagedSchema = (name: string): boolean =>
  MANAGED_SCHEMAS.some((pattern) =>
    pattern.endsWith("*") ? name.startsWith(pattern.slice(0, -1)) : name === pattern,
  );

// The schemas whose absence from stock PostgreSQL is a reference to the platform. A role is a platform
// reference when the dump names it and stock lacks it; any `supabase_` name is one too.
export const PLATFORM_SCHEMAS: readonly string[] = [
  "auth",
  "storage",
  "realtime",
  "vault",
  "cron",
  "pgmq",
  "net",
  "supabase_functions",
  "extensions",
  "graphql",
];
const PLATFORM_PREFIX = "supabase_";

// SQLSTATEs of "that object does not exist": undefined table, function, object, schema, column.
const MISSING_OBJECT_CODES = new Set(["42P01", "42883", "42704", "3F000", "42703"]);

// What a probe on the fixture must never fail with: a missing object or a syntax error means a wrong probe.
export const BROKEN_PROBE_CODES: ReadonlySet<string> = new Set([...MISSING_OBJECT_CODES, "42601"]);

// Object kinds a schema-scoped dump never holds: they are database-level objects or rows of platform tables.
const NOT_DUMPABLE_KINDS = new Set<string>([
  "extension",
  "publication",
  "publication-table",
  "role-setting",
  "cron-job",
  "vault-secret",
  "queue",
  "foreign-server",
  "user-mapping",
  "bucket",
]);

// Kinds whose names an error message can name when the object was never created.
const NAMEABLE_KINDS = new Set<string>([
  "schema",
  "table",
  "view",
  "materialized-view",
  "foreign-table",
  "function",
  "operator",
  "index",
  "sequence",
]);

export type Status = "loaded" | "failed" | "cascade" | "absent" | "unexplained";
export type Verdict = "proof" | "cascade" | "excluded" | "mismatch";
export type ProbeComparison = "same" | "differs";

// An object of the manifest, or a thing a statement creates or alters, in the manifest's object shape.
const TARGET_FIELDS = OBJECT_KEYS.filter((key) => key !== "object");
type TargetField = (typeof TARGET_FIELDS)[number];
export type Target = { kind: string } & Partial<Record<TargetField, string>>;

export interface Statement {
  index: number;
  text: string;
  tree: Row;
  kind: string;
}

export type Outcome = { ok: true } | { ok: false; sqlstate: string; message: string };
export interface StatementResult {
  statement: Statement;
  outcome: Outcome;
}

export interface OracleEntry {
  id: string;
  kind: "tie" | "control";
  mode: OracleMode;
  probe: string;
  // The platform names a `load-fails` entry's failure must name: schemas and/or roles.
  failsOn: string[];
  objects: Target[];
  postgresMajor: number | undefined;
}

// What one load pass says about an entry. `named` holds the entry's `failsOn` names that the failure
// messages of its own statements name as whole identifiers.
export interface PassResult {
  status: Status;
  named: string[];
}

export interface EntryJudgement extends PassResult {
  id: string;
  sqlstates: string[];
}

export interface StatementRef {
  index: number;
  sqlstate: string;
}

export interface Judgement {
  entries: EntryJudgement[];
  unexplained: StatementRef[];
  unattributed: StatementRef[];
  // Failures only on a platform role, in statements no entry owns: the grants the platform's default
  // privileges add to every object. Listed, never used as proof, never unexplained.
  platformAcl: StatementRef[];
}

// --- reading parse trees -------------------------------------------------------------------------

const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const inner = (node: unknown, type: string): Row | undefined => {
  if (!isRow(node)) return undefined;
  const found = node[type];
  return isRow(found) ? found : undefined;
};
const strings = (nodes: unknown): string[] =>
  list(nodes).flatMap((node) => {
    const value = str(inner(node, "String")?.["sval"]);
    return value === undefined ? [] : [value];
  });
const row = (value: unknown): Row | undefined => (isRow(value) ? value : undefined);

function target(kind: string, fields: Partial<Record<TargetField, string | undefined>>): Target {
  const out: Target = { kind };
  for (const field of TARGET_FIELDS) {
    const value = fields[field];
    if (value !== undefined) out[field] = value;
  }
  return out;
}

const relation = (value: unknown): { schema: string | undefined; name: string } | undefined => {
  const rel = row(value);
  const name = str(rel?.["relname"]);
  return rel === undefined || name === undefined ? undefined : { schema: str(rel["schemaname"]), name };
};

// The names of a qualified object, as the parser lists them: [schema, name] or [schema, table, column].
const qualified = (names: string[]): { schema: string | undefined; rest: string[] } =>
  names.length > 1 ? { schema: names[0], rest: names.slice(1) } : { schema: undefined, rest: names };

// A type's identity: its name without a pg_catalog prefix, and its array dimensions.
function typeKey(typeName: unknown): string {
  const tn = row(typeName);
  if (tn === undefined) return "";
  const names = strings(tn["names"]).filter((name) => name !== "pg_catalog");
  return names.join(".") + "[]".repeat(list(tn["arrayBounds"]).length);
}

// The identity arguments of a function: the types of its input parameters, in order.
function signature(parameters: unknown): string {
  return list(parameters)
    .flatMap((node) => {
      const parameter = inner(node, "FunctionParameter");
      const mode = str(parameter?.["mode"]);
      if (parameter === undefined || mode === "FUNC_PARAM_OUT" || mode === "FUNC_PARAM_TABLE") return [];
      return [typeKey(parameter["argType"])];
    })
    .join(",");
}

const typesOf = (nodes: unknown): string =>
  list(nodes)
    .map((node) => typeKey(inner(node, "TypeName")))
    .join(",");

// Turns the manifest's `cellar uuid, n integer` (names optional) into the signature the parser reports.
export function normalizeArgs(args: string): string {
  const parsed = parseSync(`create function f(${args}) returns void language sql as ''`);
  const stmt = inner(row(parsed.stmts?.[0])?.["stmt"], "CreateFunctionStmt");
  return signature(stmt?.["parameters"]);
}

// --- splitting a dump ----------------------------------------------------------------------------

// Leading whitespace and comments belong to the gap between statements, not to the statement.
function stripLeadingGap(text: string): string {
  let rest = text;
  for (;;) {
    const next = rest.replace(/^(?:\s+|--[^\n]*)/, "");
    if (next !== rest) {
      rest = next;
      continue;
    }
    if (!rest.startsWith("/*")) return rest;
    let depth = 0;
    let at = 0;
    for (; at < rest.length; at++) {
      if (rest.startsWith("/*", at)) depth++;
      else if (rest.startsWith("*/", at)) depth--;
      if (depth === 0) break;
    }
    rest = rest.slice(at + 2);
  }
}

// Drops psql meta-command lines, then splits with the PostgreSQL parser. The whole dump is parsed before
// anything runs, so a backslash outside a quoted string (a psql meta-command smuggled mid-line) is a syntax
// error here. A text line that starts with a backslash inside a literal would be dropped too; pg_dump
// writes none. Call `loadModule()` from libpg-query first.
export function splitDump(sql: string): Statement[] {
  const clean = sql
    .split("\n")
    .filter((line) => !line.startsWith("\\"))
    .join("\n");
  const bytes = Buffer.from(clean, "utf8");
  return (parseSync(clean).stmts ?? []).map((raw, index) => {
    const start = raw.stmt_location ?? 0;
    const length = raw.stmt_len ?? bytes.length - start;
    const node = row(raw.stmt) ?? {};
    const kind = Object.keys(node)[0] ?? "";
    return {
      index,
      text: stripLeadingGap(bytes.subarray(start, start + length).toString("utf8")),
      tree: row(node[kind]) ?? {},
      kind,
    };
  });
}

// --- what a statement creates or alters ------------------------------------------------------------

const REPLICA_SETTINGS: Record<string, string> = { d: "default", n: "nothing", f: "full", i: "index" };
const GRANT_ON: Record<string, string> = {
  OBJECT_TABLE: "table",
  OBJECT_SEQUENCE: "sequence",
  OBJECT_FUNCTION: "function",
  OBJECT_PROCEDURE: "function",
  OBJECT_ROUTINE: "function",
  OBJECT_SCHEMA: "schema",
};
const DEFAULT_PRIVILEGE_CLASS: Record<string, string> = {
  OBJECT_TABLE: "tables",
  OBJECT_SEQUENCE: "sequences",
  OBJECT_FUNCTION: "functions",
  OBJECT_ROUTINE: "functions",
  OBJECT_TYPE: "types",
  OBJECT_SCHEMA: "schemas",
};
const RELATION_KIND: Record<string, string> = {
  OBJECT_TABLE: "table",
  OBJECT_VIEW: "view",
  OBJECT_MATVIEW: "materialized-view",
  OBJECT_FOREIGN_TABLE: "foreign-table",
  OBJECT_SEQUENCE: "sequence",
  OBJECT_INDEX: "index",
};

// `public.some_seq` or `public."odd.name"` as written in a regclass literal.
function splitQualifiedText(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  for (let at = 0; at < text.length; at++) {
    const char = text.charAt(at);
    if (char === '"' && quoted && text.charAt(at + 1) === '"') {
      current += '"';
      at++;
    } else if (char === '"') quoted = !quoted;
    else if (char === "." && !quoted) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  return [...parts, current];
}

function columnTargets(rel: { schema: string | undefined; name: string }, elements: unknown): Target[] {
  const out: Target[] = [];
  for (const element of list(elements)) {
    const column = inner(element, "ColumnDef");
    const constraint = inner(element, "Constraint");
    const named = str(constraint?.["conname"]);
    if (constraint !== undefined && named !== undefined) {
      out.push(target("constraint", { schema: rel.schema, table: rel.name, name: named }));
    }
    const colname = str(column?.["colname"]);
    if (column === undefined || colname === undefined) continue;
    out.push(target("column", { schema: rel.schema, table: rel.name, name: colname }));
    for (const node of list(column["constraints"])) {
      const inline = inner(node, "Constraint");
      const type = str(inline?.["contype"]);
      if (type === "CONSTR_DEFAULT") {
        out.push(target("column-default", { schema: rel.schema, table: rel.name, name: colname }));
      }
      const inlineName = str(inline?.["conname"]);
      if (inlineName !== undefined) {
        out.push(target("constraint", { schema: rel.schema, table: rel.name, name: inlineName }));
      }
    }
  }
  return out;
}

function grantTargets(grant: Row, schemas: (string | undefined)[], defaults: boolean): Target[] {
  const objtype = str(grant["objtype"]) ?? "";
  const privileges = list(grant["privileges"]).flatMap((node) => {
    const name = str(inner(node, "AccessPriv")?.["priv_name"]);
    return name === undefined ? [] : [name.toLowerCase()];
  });
  const privilegeList = privileges.length > 0 ? privileges : ["all"];
  const roles = list(grant["grantees"]).flatMap((node) => {
    const spec = inner(node, "RoleSpec");
    if (spec === undefined) return [];
    return [str(spec["rolename"]) ?? (str(spec["roletype"]) === "ROLESPEC_PUBLIC" ? "public" : "")];
  });
  const out: Target[] = [];
  if (defaults) {
    const name = DEFAULT_PRIVILEGE_CLASS[objtype];
    for (const schema of schemas) {
      for (const role of roles) {
        for (const privilege of privilegeList) {
          out.push(target("default-privilege", { schema, name, role, privilege }));
        }
      }
    }
    return out;
  }
  const on = GRANT_ON[objtype] ?? objtype.replace("OBJECT_", "").toLowerCase();
  for (const object of list(grant["objects"])) {
    const rel = relation(inner(object, "RangeVar"));
    const withArgs = inner(object, "ObjectWithArgs");
    const schemaName = str(inner(object, "String")?.["sval"]);
    let where: { schema: string | undefined; name: string | undefined; args?: string | undefined };
    if (rel !== undefined) where = rel;
    else if (withArgs !== undefined) {
      const { schema, rest } = qualified(strings(withArgs["objname"]));
      where = {
        schema,
        name: rest[0],
        args: withArgs["args_unspecified"] === true ? undefined : typesOf(withArgs["objargs"]),
      };
    } else where = { schema: schemaName, name: schemaName };
    for (const role of roles) {
      for (const privilege of privilegeList) {
        out.push(target("grant", { on, schema: where.schema, name: where.name, args: where.args, role, privilege }));
      }
    }
  }
  return out;
}

function alterTableTargets(tree: Row): Target[] {
  const rel = relation(tree["relation"]);
  if (rel === undefined) return [];
  const objtype = str(tree["objtype"]) ?? "OBJECT_TABLE";
  const kind = RELATION_KIND[objtype] ?? "table";
  const out: Target[] = [];
  for (const node of list(tree["cmds"])) {
    const cmd = inner(node, "AlterTableCmd");
    const subtype = str(cmd?.["subtype"]);
    if (cmd === undefined || subtype === undefined) continue;
    const def = row(cmd["def"]);
    const owner = { schema: rel.schema, table: rel.name };
    switch (subtype) {
      case "AT_AddConstraint":
        out.push(target("constraint", { ...owner, name: str(inner(def, "Constraint")?.["conname"]) }));
        break;
      case "AT_EnableRowSecurity":
      case "AT_DisableRowSecurity":
      case "AT_ForceRowSecurity":
      case "AT_NoForceRowSecurity":
        out.push(target("rls", owner));
        break;
      case "AT_ReplicaIdentity": {
        const type = str(inner(def, "ReplicaIdentityStmt")?.["identity_type"]) ?? "";
        out.push(target("replica-identity", { ...owner, setting: REPLICA_SETTINGS[type] }));
        break;
      }
      case "AT_AttachPartition": {
        const child = relation(inner(def, "PartitionCmd")?.["name"]);
        out.push(target(kind, { schema: rel.schema, name: rel.name }));
        if (child !== undefined) out.push(target(kind, { schema: child.schema, name: child.name }));
        break;
      }
      case "AT_AddIdentity":
      case "AT_SetIdentity": {
        out.push(target("column", { ...owner, name: str(cmd["name"]) }));
        for (const option of list(inner(def, "Constraint")?.["options"])) {
          const elem = inner(option, "DefElem");
          if (str(elem?.["defname"]) !== "sequence_name") continue;
          const { schema, rest } = qualified(strings(inner(elem?.["arg"], "List")?.["items"]));
          out.push(target("sequence", { schema, name: rest[0] }));
        }
        break;
      }
      case "AT_ColumnDefault":
        out.push(target("column-default", { ...owner, name: str(cmd["name"]) }));
        break;
      case "AT_AddColumn": {
        const column = inner(def, "ColumnDef");
        out.push(...columnTargets(rel, [{ ColumnDef: column }]));
        break;
      }
      default:
        if (str(cmd["name"]) !== undefined) out.push(target("column", { ...owner, name: str(cmd["name"]) }));
        else out.push(target(kind, { schema: rel.schema, name: rel.name }));
    }
  }
  return out;
}

// The objects a statement creates or alters, in the manifest's object shape; `session` and `data` mark
// statements that set a session variable or insert rows.
export function targetsOf(statement: Statement): Target[] {
  const tree = statement.tree;
  switch (statement.kind) {
    case "CreateSchemaStmt":
      return [target("schema", { name: str(tree["schemaname"]) })];
    case "AlterOwnerStmt": {
      const objectType = str(tree["objectType"]);
      const object = row(tree["object"]);
      if (objectType === "OBJECT_SCHEMA") return [target("schema", { name: str(inner(object, "String")?.["sval"]) })];
      const withArgs = inner(object, "ObjectWithArgs");
      const { schema, rest } = qualified(strings(withArgs?.["objname"]));
      const args = typesOf(withArgs?.["objargs"]);
      if (objectType === "OBJECT_FUNCTION" || objectType === "OBJECT_PROCEDURE") {
        return [target("function", { schema, name: rest[0], args })];
      }
      if (objectType === "OBJECT_OPERATOR") return [target("operator", { schema, name: rest[0], args })];
      return [];
    }
    case "CommentStmt": {
      const objtype = str(tree["objtype"]) ?? "";
      const object = row(tree["object"]);
      if (objtype === "OBJECT_SCHEMA") return [target("schema", { name: str(inner(object, "String")?.["sval"]) })];
      if (objtype === "OBJECT_FUNCTION") {
        const withArgs = inner(object, "ObjectWithArgs");
        const { schema, rest } = qualified(strings(withArgs?.["objname"]));
        return [target("function", { schema, name: rest[0], args: typesOf(withArgs?.["objargs"]) })];
      }
      const names = strings(inner(object, "List")?.["items"]);
      if (objtype === "OBJECT_COLUMN") {
        return [target("comment", { schema: names[0], table: names[1], column: names[2] })];
      }
      if (objtype in RELATION_KIND) return [target("comment", { schema: names[0], table: names[1] })];
      return [];
    }
    case "CreateFunctionStmt": {
      const { schema, rest } = qualified(strings(tree["funcname"]));
      return [target("function", { schema, name: rest[0], args: signature(tree["parameters"]) })];
    }
    case "CreateStmt": {
      const rel = relation(tree["relation"]);
      if (rel === undefined) return [];
      return [target("table", rel), ...columnTargets(rel, tree["tableElts"])];
    }
    case "CreateForeignTableStmt": {
      const base = row(tree["base"]);
      const rel = relation(base?.["relation"]);
      if (rel === undefined) return [];
      return [target("foreign-table", rel), ...columnTargets(rel, base?.["tableElts"])];
    }
    case "ViewStmt": {
      const rel = relation(tree["view"]);
      return rel === undefined ? [] : [target("view", rel)];
    }
    case "CreateTableAsStmt": {
      const rel = relation(row(tree["into"])?.["rel"]);
      if (rel === undefined) return [];
      return [target(str(tree["objtype"]) === "OBJECT_MATVIEW" ? "materialized-view" : "table", rel)];
    }
    case "RefreshMatViewStmt": {
      const rel = relation(tree["relation"]);
      return rel === undefined ? [] : [target("materialized-view", rel)];
    }
    case "IndexStmt": {
      const rel = relation(tree["relation"]);
      return [target("index", { schema: rel?.schema, name: str(tree["idxname"]) })];
    }
    case "CreateTrigStmt": {
      const rel = relation(tree["relation"]);
      return [target("trigger", { schema: rel?.schema, table: rel?.name, name: str(tree["trigname"]) })];
    }
    case "CreatePolicyStmt": {
      const rel = relation(tree["table"]);
      return [target("policy", { schema: rel?.schema, table: rel?.name, name: str(tree["policy_name"]) })];
    }
    case "AlterTableStmt":
      return alterTableTargets(tree);
    case "DefineStmt": {
      if (str(tree["kind"]) !== "OBJECT_OPERATOR") return [];
      const { schema, rest } = qualified(strings(tree["defnames"]));
      const sides = new Map(
        list(tree["definition"]).flatMap((node) => {
          const elem = inner(node, "DefElem");
          const name = str(elem?.["defname"]);
          return name === undefined ? [] : [[name, typeKey(inner(elem?.["arg"], "TypeName"))] as const];
        }),
      );
      const args = [sides.get("leftarg"), sides.get("rightarg")].filter((side) => side !== undefined).join(",");
      return [target("operator", { schema, name: rest[0], args })];
    }
    case "GrantStmt":
      return grantTargets(tree, [], false);
    case "AlterDefaultPrivilegesStmt": {
      const schemas = list(tree["options"]).flatMap((node) => {
        const elem = inner(node, "DefElem");
        return str(elem?.["defname"]) === "schemas" ? strings(inner(elem?.["arg"], "List")?.["items"]) : [];
      });
      const action = row(tree["action"]) ?? {};
      return grantTargets(action, schemas.length > 0 ? schemas : [undefined], true);
    }
    case "CreateSeqStmt":
    case "AlterSeqStmt": {
      const rel = relation(tree["sequence"]);
      return rel === undefined ? [] : [target("sequence", rel)];
    }
    case "InsertStmt": {
      const rel = relation(tree["relation"]);
      return [target("data", { schema: rel?.schema, table: rel?.name })];
    }
    case "VariableSetStmt":
      return [target("session", {})];
    case "SelectStmt": {
      const first = list(tree["targetList"])[0];
      const call = inner(inner(first, "ResTarget")?.["val"], "FuncCall");
      const func = strings(call?.["funcname"]).at(-1);
      if (func === "set_config") return [target("session", {})];
      if (func === "setval") {
        const literal = row(inner(list(call?.["args"])[0], "A_Const")?.["sval"]);
        const { schema, rest } = qualified(splitQualifiedText(str(literal?.["sval"]) ?? ""));
        return [target("sequence", { schema, name: rest[0] })];
      }
      return [];
    }
    default:
      return [];
  }
}

// --- attributing statements to manifest entries ---------------------------------------------------------

// The fields that identify an object of each kind. `privilege` is compared apart, and a statement that
// leaves `args` out (`grant ... on function f`) matches any signature.
const IDENTITY: Partial<Record<ObjectKind, readonly TargetField[]>> = {
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
  grant: ["on", "schema", "name", "args", "role"],
  "default-privilege": ["schema", "name", "role"],
  "replica-identity": ["schema", "table", "setting"],
  comment: ["schema", "table", "column"],
  "foreign-table": ["schema", "name"],
  operator: ["schema", "name", "args"],
};

function matches(object: Target, created: Target): boolean {
  if (object.kind !== created.kind || !isObjectKind(object.kind)) return false;
  const fields = IDENTITY[object.kind];
  if (fields === undefined) return false;
  for (const field of fields) {
    if (field === "args" && created.args === undefined) continue;
    if (object[field] !== created[field]) return false;
  }
  if (object.kind === "grant" || object.kind === "default-privilege") {
    const want = object.privilege?.toLowerCase();
    if (created.privilege !== "all" && created.privilege !== want) return false;
  }
  return true;
}

export interface Attribution {
  byEntry: Map<string, number[]>;
  byStatement: Map<number, string[]>;
  targets: Map<number, Target[]>;
}

// Maps each statement to the entries whose location objects it creates or alters.
export function attribute(statements: Statement[], entries: OracleEntry[]): Attribution {
  const byEntry = new Map<string, number[]>(entries.map((entry) => [entry.id, []]));
  const byStatement = new Map<number, string[]>();
  const targets = new Map<number, Target[]>();
  for (const statement of statements) {
    const created = targetsOf(statement);
    targets.set(statement.index, created);
    const owners = entries.filter((entry) =>
      entry.objects.some((object) => created.some((one) => matches(object, one))),
    );
    byStatement.set(
      statement.index,
      owners.map((entry) => entry.id),
    );
    for (const owner of owners) byEntry.get(owner.id)?.push(statement.index);
  }
  return { byEntry, byStatement, targets };
}

// --- judging ---------------------------------------------------------------------------------------

type Cause = "dependency" | "platform" | "missing" | "unexplained";

const PRIORITY: Status[] = ["unexplained", "failed", "cascade", "loaded"];

// The identifiers a message names, whole: each part of a quoted or bare, schema-qualified name, and the
// qualified name itself. `"public.t"`, `public.t` and `auth.uid()` name `public`, `t`, `auth` and `uid`,
// never `pub` or `au`; a short object name cannot match inside a longer word.
const IDENTIFIER = String.raw`"(?:[^"]|"")*"|[\p{L}_][\p{L}\p{N}_$]*`;
const CHAIN = new RegExp(`(?:${IDENTIFIER})(?:\\.(?:${IDENTIFIER}))*`, "gu");
const PART = new RegExp(IDENTIFIER, "gu");

export function identifiersIn(message: string): Set<string> {
  const found = new Set<string>();
  for (const [chain] of message.matchAll(CHAIN)) {
    const parts = [...chain.matchAll(PART)].map(([part]) =>
      part.startsWith('"') ? part.slice(1, -1).replaceAll('""', '"') : part,
    );
    for (const part of parts) {
      found.add(part);
      for (const piece of part.split(".")) found.add(piece);
    }
    found.add(parts.join("."));
  }
  return found;
}

const namesAny = (identifiers: Set<string>, names: Iterable<string>): boolean =>
  [...names].some((name) => identifiers.has(name));
const namesPlatformPrefix = (identifiers: Set<string>): boolean =>
  [...identifiers].some((name) => name.startsWith(PLATFORM_PREFIX));

// A failed statement's cause. A statement that names an object an earlier failure left uncreated is a
// dependency; one that names the platform is a platform reference; one that names an object a dump never
// holds is a missing one; anything else is unexplained.
function causeOf(
  sqlstate: string,
  identifiers: Set<string>,
  failed: Set<string>,
  missing: Set<string>,
  platform: Set<string>,
): Cause {
  if (MISSING_OBJECT_CODES.has(sqlstate) && namesAny(identifiers, failed)) return "dependency";
  if (namesAny(identifiers, platform) || namesPlatformPrefix(identifiers)) return "platform";
  if (MISSING_OBJECT_CODES.has(sqlstate) && namesAny(identifiers, missing)) return "missing";
  return "unexplained";
}

const nameable = (created: Target[]): string[] =>
  created.flatMap((one) => (NAMEABLE_KINDS.has(one.kind) && one.name !== undefined ? [one.name] : []));

// The statement kinds whose failures on a platform role may be the platform's own grants.
const ACL_KINDS = new Set(["GrantStmt", "AlterDefaultPrivilegesStmt"]);

// Judges each entry from the per-statement outcomes of one load pass. `roles` are the roles the dump names
// that stock lacks. An entry is judged only on the statements whose targets match its own objects: a
// statement no entry owns is never credited to one. Ties that share one statement and one cause are proven
// together: a statement that fails naming a platform name proves every tie in it that declares that name,
// and a control in it is a cascade. A failure only on a platform role in a statement no entry owns goes to
// `platformAcl`.
export function judge(
  results: StatementResult[],
  entries: OracleEntry[],
  roles: readonly string[],
): Judgement {
  const { byStatement, targets } = attribute(
    results.map((result) => result.statement),
    entries,
  );
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const platform = new Set<string>([...PLATFORM_SCHEMAS, ...roles]);
  const failedNames = new Set<string>();
  const missingNames = new Set<string>(
    entries.flatMap((entry) =>
      entry.objects.flatMap((object) =>
        NOT_DUMPABLE_KINDS.has(object.kind) && object.name !== undefined ? [object.name] : [],
      ),
    ),
  );
  const statuses = new Map<string, Status[]>(entries.map((entry) => [entry.id, []]));
  const sqlstates = new Map<string, Set<string>>(entries.map((entry) => [entry.id, new Set()]));
  const named = new Map<string, Set<string>>(entries.map((entry) => [entry.id, new Set()]));
  const unexplained: StatementRef[] = [];
  const unattributed: StatementRef[] = [];
  const platformAcl: StatementRef[] = [];
  const push = (id: string, status: Status, sqlstate?: string) => {
    statuses.get(id)?.push(status);
    if (sqlstate !== undefined) sqlstates.get(id)?.add(sqlstate);
  };

  for (const { statement, outcome } of results) {
    const ids = byStatement.get(statement.index) ?? [];
    if (outcome.ok) {
      for (const id of ids) push(id, "loaded");
      continue;
    }
    const identifiers = identifiersIn(outcome.message);
    const cause = causeOf(outcome.sqlstate, identifiers, failedNames, missingNames, platform);
    for (const name of nameable(targets.get(statement.index) ?? [])) failedNames.add(name);
    const { sqlstate } = outcome;
    if (cause === "dependency" || cause === "missing") {
      for (const id of ids) push(id, "cascade", sqlstate);
    } else if (cause === "platform") {
      // Ties, and entries that declare they fail, are where a platform reference belongs.
      const own = ids.filter((id) => {
        const entry = byId.get(id);
        return entry !== undefined && (entry.kind === "tie" || entry.mode === "load-fails");
      });
      if (own.length === 0) {
        const onlyRoles = namesAny(identifiers, roles) && !namesAny(identifiers, PLATFORM_SCHEMAS);
        if (ids.length === 0 && ACL_KINDS.has(statement.kind) && onlyRoles) {
          platformAcl.push({ index: statement.index, sqlstate });
        } else unattributed.push({ index: statement.index, sqlstate });
      }
      for (const id of ids) push(id, own.includes(id) || own.length === 0 ? "failed" : "cascade", sqlstate);
      for (const id of own) {
        for (const name of byId.get(id)?.failsOn ?? []) if (identifiers.has(name)) named.get(id)?.add(name);
      }
    } else {
      unexplained.push({ index: statement.index, sqlstate });
      for (const id of ids) push(id, "unexplained", sqlstate);
    }
  }

  return {
    entries: entries.map((entry) => {
      const seen = statuses.get(entry.id) ?? [];
      const status = PRIORITY.find((one) => seen.includes(one)) ?? "absent";
      return {
        id: entry.id,
        status,
        named: [...(named.get(entry.id) ?? [])].sort(),
        sqlstates: [...(sqlstates.get(entry.id) ?? [])].sort(),
      };
    }),
    unexplained,
    unattributed,
    platformAcl,
  };
}

// Every role the dump names, from the role specifications in its parse trees: grantees, policy roles, owners,
// default-privilege roles. The live test creates the ones stock lacks as plain stand-ins for the `roles` pass.
export function rolesOf(statements: Statement[]): string[] {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (isRow(node)) {
      // A RoleSpec is a node of its own in a list and a bare field elsewhere (an owner).
      const name = "roletype" in node ? str(node["rolename"]) : undefined;
      if (name !== undefined) found.add(name);
      else for (const value of Object.values(node)) walk(value);
    }
  };
  for (const statement of statements) walk(statement.tree);
  return [...found].sort();
}

const isPlatformSchema = (name: string): boolean => PLATFORM_SCHEMAS.includes(name);

// A failure is proof when it is the entry's own and names one of the accepted platform names; a cascade
// is recorded and listed, not counted.
function failureVerdict(pass: PassResult, accepted: readonly string[]): Verdict {
  if (pass.status === "cascade") return "cascade";
  return pass.status === "failed" && pass.named.some((name) => accepted.includes(name)) ? "proof" : "mismatch";
}

// The verdict on an entry: whether what the passes found meets its declared oracle mode. A `load-fails`
// entry is judged on the `bare` pass; one that declares a schema name must also fail in the `roles` pass
// naming a schema, so a missing role cannot stand in for a missing schema. A `cascade` on a tie that should
// fail, or on a control that should load and probe the same, is recorded and listed, not counted as proof;
// a `not-in-dump` entry that is absent is excluded from the claim. The probe modes read the `bare` pass.
export function verdictOf(
  entry: OracleEntry,
  passes: { bare: PassResult; roles: PassResult },
  probe?: ProbeComparison,
): Verdict {
  const { status } = passes.bare;
  switch (entry.mode) {
    case "load-fails": {
      const bare = failureVerdict(passes.bare, entry.failsOn);
      const schemas = entry.failsOn.filter(isPlatformSchema);
      return bare !== "proof" || schemas.length === 0 ? bare : failureVerdict(passes.roles, schemas);
    }
    case "probe-same":
      if (status === "cascade") return "cascade";
      return status === "loaded" && probe === "same" ? "proof" : "mismatch";
    case "probe-differs":
      return status === "loaded" && probe === "differs" ? "proof" : "mismatch";
    case "not-in-dump":
      return status === "absent" ? "excluded" : "mismatch";
  }
}

// --- the manifest's database entries -----------------------------------------------------------------------

function toTarget(object: Row): Target {
  const fields: Partial<Record<TargetField, string>> = {};
  for (const field of TARGET_FIELDS) {
    const value = object[field];
    if (typeof value === "string") fields[field] = field === "args" ? normalizeArgs(value) : value;
  }
  return target(String(object["object"]), fields);
}

// The manifest's database entries that declare an oracle mode.
export function oracleEntries(rows: Row[]): OracleEntry[] {
  return rows.flatMap((entry) => {
    const oracle = row(entry["oracle"]);
    const location = row(entry["location"]);
    const mode = oracle?.["mode"];
    const objects = list(location?.["database"]);
    if (oracle === undefined || !isOracleMode(mode) || objects.length === 0) return [];
    const major = entry["postgres_major"];
    return [
      {
        id: String(entry["id"]),
        kind: entry["kind"] === "control" ? "control" : "tie",
        mode,
        probe: str(oracle["probe"]) ?? "",
        failsOn: list(oracle["fails_on"]).filter((name) => typeof name === "string"),
        objects: objects.filter(isRow).map(toTarget),
        postgresMajor: typeof major === "number" ? major : undefined,
      },
    ];
  });
}

// --- the psql script and its output -------------------------------------------------------------------------

// One psql session, one transaction, each statement in its own savepoint (ON_ERROR_ROLLBACK). After each
// statement one line says `ok` or `err <sqlstate>`, followed for an error by the message, quoted by psql, up
// to an end line. Every marker starts with a random token, so a message cannot forge one. The statements go
// in as written; nothing built from their content is added.
export function buildLoadScript(statements: Statement[], token: string): string {
  const mark = `NW${token}`;
  const lines = ["\\set ON_ERROR_ROLLBACK on", "\\o /dev/null", "BEGIN;"];
  for (const statement of statements) {
    lines.push(`${statement.text};`);
    lines.push("\\if :ERROR");
    lines.push(`\\echo ${mark} ${String(statement.index)} err :LAST_ERROR_SQLSTATE`);
    lines.push("\\echo :'LAST_ERROR_MESSAGE'");
    lines.push(`\\echo ${mark} ${String(statement.index)} end`);
    lines.push("\\else");
    lines.push(`\\echo ${mark} ${String(statement.index)} ok`);
    lines.push("\\endif");
  }
  lines.push("COMMIT;", `\\echo ${mark} done`, "");
  return lines.join("\n");
}

// psql prints `:'var'` quoted as an SQL literal: 'text' with '' for a quote, or E'text' with \\ for a backslash.
function unquoteLiteral(text: string): string {
  const escaped = text.startsWith("E'");
  const body = text.slice(escaped ? 2 : 1, text.endsWith("'") ? -1 : undefined).replaceAll("''", "'");
  return escaped ? body.replaceAll("\\\\", "\\") : body;
}

// Reads the load script's standard output into one outcome per statement; throws when it is not complete.
export function parseLoadOutput(stdout: string, token: string, count: number): Outcome[] {
  const mark = `NW${token} `;
  const outcomes: Outcome[] = [];
  const lines = stdout.split("\n");
  let done = false;
  for (let at = 0; at < lines.length; at++) {
    const line = lines[at] ?? "";
    if (!line.startsWith(mark)) continue;
    const [index, word, code] = line.slice(mark.length).split(" ");
    if (index === "done") {
      done = true;
    } else if (Number(index) !== outcomes.length) {
      throw new Error(`the load output is out of step at statement ${String(outcomes.length)}`);
    } else if (word === "ok") {
      outcomes.push({ ok: true });
    } else if (word === "err" && code !== undefined) {
      const message: string[] = [];
      for (at++; at < lines.length && lines[at] !== `${mark}${index} end`; at++) message.push(lines[at] ?? "");
      outcomes.push({ ok: false, sqlstate: code, message: unquoteLiteral(message.join("\n").trimStart()) });
    }
  }
  if (!done || outcomes.length !== count) {
    throw new Error(`the load output holds ${String(outcomes.length)} of ${String(count)} statements`);
  }
  return outcomes;
}

// --- reporting ------------------------------------------------------------------------------------------------

export interface EntryReport {
  id: string;
  mode: OracleMode;
  status: Status;
  sqlstates: string[];
  verdict: Verdict;
}

// Counts and lists for the summary; it holds ids, modes, statement numbers and SQLSTATEs only, never an
// object name or message.
export function summarize(reports: EntryReport[], platformAcl: StatementRef[]): string[] {
  const count = (pick: (report: EntryReport) => string): string => {
    const counts = new Map<string, number>();
    for (const report of reports) counts.set(pick(report), (counts.get(pick(report)) ?? 0) + 1);
    return [...counts].map(([name, total]) => `${name} ${String(total)}`).join(", ");
  };
  const ids = (verdict: Verdict) =>
    reports.filter((report) => report.verdict === verdict).map((report) => report.id);
  return [
    `oracle: ${String(reports.length)} entries`,
    `verdicts: ${count((report) => report.verdict)}`,
    `statuses: ${count((report) => report.status)}`,
    `cascade (recorded, not proof): ${ids("cascade").join(" ")}`,
    `not-in-dump (excluded from the claim): ${ids("excluded").join(" ")}`,
    `platform ACL (grants to platform roles that no entry lists; not proof): ${String(platformAcl.length)} statements: ${platformAcl.map((one) => `${String(one.index)}:${one.sqlstate}`).join(" ")}`,
  ];
}
