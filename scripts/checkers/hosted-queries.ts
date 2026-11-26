// Keeps the hosted verification queries inside their rules, on the syntax tree
// a real PostgreSQL parser produces: one SELECT, no write, no locking clause,
// and only relations and functions from the lists below. A change to a list is
// reviewed like the queries themselves.
import type { Problem } from "../lib/problem.ts";

const RELATIONS = new Set([
  "pg_catalog.pg_class",
  "pg_catalog.pg_namespace",
  "pg_catalog.pg_policy",
  "pg_catalog.pg_db_role_setting",
  "pg_catalog.pg_roles",
  "pg_catalog.pg_extension",
  "pg_catalog.pg_proc",
  "pg_catalog.pg_publication",
  "information_schema.tables",
]);
const FUNCTIONS = new Set([
  "count",
  "bool_or",
  "pg_get_expr",
  "has_table_privilege",
  "split_part",
  "unnest",
  "current_setting",
]);
const SETTINGS = new Set([
  "server_version_num",
  "transaction_read_only",
  "default_transaction_read_only",
]);
const FORBIDDEN_NODES = new Set(["InsertStmt", "UpdateStmt", "DeleteStmt", "MergeStmt"]);
const FORBIDDEN_KEYS = new Set(["intoClause", "lockingClause"]);

type Tree = Record<string, unknown>;

const isTree = (value: unknown): value is Tree => typeof value === "object" && value !== null;
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const names = (parts: unknown): string[] =>
  (Array.isArray(parts) ? parts : []).map((part) =>
    isTree(part) && isTree(part["String"]) ? text(part["String"]["sval"]) : "?",
  );

/** Checks the parse result of one query file (the parser's output for its whole text). */
export function checkHostedQuery(file: string, parsed: unknown): Problem[] {
  const problems: Problem[] = [];
  const add = (message: string) => problems.push({ rule: "hosted-query", file, message });

  const statements: unknown[] =
    isTree(parsed) && Array.isArray(parsed["stmts"]) ? (parsed["stmts"] as unknown[]) : [];
  const first = statements[0];
  const statement = isTree(first) ? first["stmt"] : undefined;
  if (statements.length !== 1 || !isTree(statement) || !("SelectStmt" in statement)) {
    add("must be exactly one SELECT statement");
    return problems;
  }

  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isTree(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (FORBIDDEN_NODES.has(key)) add(`contains a data-modifying statement (${key})`);
      if (FORBIDDEN_KEYS.has(key)) {
        add(`contains ${key === "intoClause" ? "INTO" : "a locking clause"}`);
      }
      if (key === "RangeVar" && isTree(value)) {
        const relation = `${text(value["schemaname"])}.${text(value["relname"])}`;
        if (!RELATIONS.has(relation)) add(`reads '${relation}', which is not on the relation list`);
      }
      if (key === "FuncCall" && isTree(value)) {
        const parts = names(value["funcname"]);
        const name = parts.at(-1) ?? "?";
        const qualified = parts.length === 1 || (parts.length === 2 && parts[0] === "pg_catalog");
        if (!qualified || !FUNCTIONS.has(name)) {
          add(`calls '${parts.join(".")}', which is not on the function list`);
        }
        if (name === "current_setting") {
          const args: unknown[] = Array.isArray(value["args"]) ? (value["args"] as unknown[]) : [];
          const argument = args[0];
          const constant =
            isTree(argument) && isTree(argument["A_Const"]) ? argument["A_Const"] : {};
          const setting = isTree(constant["sval"]) ? text(constant["sval"]["sval"]) : "";
          if (!SETTINGS.has(setting)) add("reads a setting that is not on the setting list");
        }
      }
      visit(value);
    }
  };
  visit(statement);
  return problems;
}
