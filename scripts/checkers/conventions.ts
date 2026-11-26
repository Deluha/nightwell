// The mechanical code rules. What each function parses and enforces is listed
// in the skill's checkers reference.
import { parse } from "@babel/parser";
import { matchesAny } from "../lib/glob.ts";
import type { Problem } from "../lib/problem.ts";

export interface SourceFile {
  path: string;
  text: string;
}

export interface ForbiddenList {
  platformName: string;
  exempt: readonly string[];
  identifiers: readonly string[];
}

interface Node {
  type: string;
  loc?: { start: { line: number } } | null;
  [key: string]: unknown;
}

const CLI_DIR = "src/cli/";
const THIN_ENTRY_GLOBS = ["src/cli/main.ts", "src/cli/commands/*.ts"];
const THIN_ENTRY_MAX_LINES = 40;
const PROCESS_ONLY_IN_CLI = new Set([
  "exit",
  "exitCode",
  "env",
  "stdout",
  "stderr",
  "stdin",
  "argv",
]);

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "range") continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (isNode(child)) walk(child, visit);
    }
  }
}

/** Renders `a.b.c` for a member chain of plain identifiers, else undefined. */
function qualifiedName(node: Node): string | undefined {
  if (node.type === "Identifier") return node["name"] as string;
  if (node.type !== "MemberExpression" || node["computed"] === true) return undefined;
  const object = qualifiedName(node["object"] as Node);
  const property = node["property"] as Node;
  return object !== undefined && property.type === "Identifier"
    ? `${object}.${property["name"] as string}`
    : undefined;
}

function literalValue(node: Node): string | undefined {
  if (node.type === "StringLiteral") return node["value"] as string;
  if (node.type === "TemplateLiteral" && (node["expressions"] as unknown[]).length === 0) {
    const quasi = (node["quasis"] as Node[])[0];
    return (quasi?.["value"] as { cooked?: string } | undefined)?.cooked;
  }
  return undefined;
}

/** R2, the process and console boundary, and thin entry files, for files under `src/`. */
export function checkSource(files: readonly SourceFile[], forbidden: ForbiddenList): Problem[] {
  const problems: Problem[] = [];
  const platform = forbidden.platformName.toLowerCase();
  const identifiers = new Set(forbidden.identifiers.map((id) => id.toLowerCase()));
  const exempt = new Set(forbidden.exempt.map((id) => id.toLowerCase()));
  const isForbidden = (value: string) =>
    identifiers.has(value.toLowerCase()) && !exempt.has(value.toLowerCase());

  for (const file of files) {
    const add = (rule: string, node: Node, message: string) =>
      problems.push({ rule, file: file.path, line: node.loc?.start.line ?? 1, message });

    if (matchesAny(file.path, THIN_ENTRY_GLOBS)) {
      const lines = file.text.split("\n").filter((line) => line.trim() !== "").length;
      if (lines > THIN_ENTRY_MAX_LINES) {
        problems.push({
          rule: "thin-entry",
          file: file.path,
          message: `entry file has ${lines} lines; keep it to ${THIN_ENTRY_MAX_LINES} and move logic out`,
        });
      }
    }

    let ast: Node;
    try {
      ast = parse(file.text, { sourceType: "module", plugins: ["typescript"] }) as unknown as Node;
    } catch (error) {
      problems.push({
        rule: "parse",
        file: file.path,
        message: `cannot be parsed: ${error instanceof Error ? error.message : String(error)}`,
      });
      continue;
    }
    const inCli = file.path.startsWith(CLI_DIR);

    walk(ast, (node) => {
      if (node.type === "Identifier" || node.type === "PrivateName") {
        const name = typeof node["name"] === "string" ? node["name"] : "";
        if (name.toLowerCase().includes(platform)) {
          add("R2", node, `identifier '${name}' contains the platform's name`);
        }
      }
      if (node.type === "MemberExpression") {
        const name = qualifiedName(node);
        if (name !== undefined && isForbidden(name)) {
          add("R2", node, `qualified name '${name}' belongs in the rule pack`);
        }
        const object = node["object"] as Node;
        const property = node["property"] as Node;
        if (!inCli && object.type === "Identifier") {
          if (object["name"] === "console") {
            add("cli-boundary", node, "console is used outside src/cli/");
          }
          const member = property.type === "Identifier" ? String(property["name"]) : "";
          if (object["name"] === "process" && PROCESS_ONLY_IN_CLI.has(member)) {
            add("cli-boundary", node, `process.${member} is used outside src/cli/`);
          }
        }
      }
      const value = literalValue(node);
      if (value !== undefined && isForbidden(value)) {
        add("R2", node, `string literal '${value}' belongs in the rule pack`);
      }
    });
  }
  return problems;
}

/** Reads the globs in the fenced `permanent-docs` block of the conventions reference. */
export function parsePermanentDocs(conventions: string): string[] {
  const block = /```permanent-docs\n([\s\S]*?)```/.exec(conventions);
  if (block?.[1] === undefined) return [];
  return block[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

const BUILD_ARTIFACTS = ["dist/**", "coverage/**", "node_modules/**", ".tools/**", "**/*.tgz"];
const SECRET_FILES = ["**/.env", "**/.env.*", "**/*.pem", "**/*.key", "**/*.p12", "**/*.pfx"];
const SECRET_FILE_EXCEPTIONS = ["**/.env.example"];
const TEST_FILES = ["**/*.test.ts", "**/*.spec.ts", "**/*.test.js", "**/*.spec.js"];

/** R8 and the tracked-file rules, over the list of files in the working tree. */
export function checkFiles(paths: readonly string[], permanentDocs: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  for (const file of paths) {
    if (matchesAny(file, BUILD_ARTIFACTS)) {
      problems.push({ rule: "no-artifact", file, message: "build artifact must not be tracked" });
    }
    if (matchesAny(file, SECRET_FILES) && !matchesAny(file, SECRET_FILE_EXCEPTIONS)) {
      problems.push({ rule: "no-secret-file", file, message: "secret file must not be tracked" });
    }
    if (matchesAny(file, TEST_FILES) && !file.startsWith("tests/")) {
      problems.push({ rule: "R8", file, message: "tests live only in tests/" });
    }
    if (file.toLowerCase().endsWith(".md") && !matchesAny(file, permanentDocs)) {
      problems.push({
        rule: "R8",
        file,
        message: "Markdown file is not in the permanent docs list (conventions.md)",
      });
    }
  }
  return problems;
}

interface LockEntry {
  resolved?: string;
  integrity?: string;
  link?: boolean;
  dev?: boolean;
  devOptional?: boolean;
  hasInstallScript?: boolean;
}

const REGISTRY = "https://registry.npmjs.org/";

/** Lints the lockfile and compares the production tree with the committed list. */
export function checkLockfile(lock: unknown, allowedProduction: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  const file = "package-lock.json";
  const packages = (lock as { packages?: Record<string, LockEntry> }).packages;
  if (packages === undefined) {
    return [
      { rule: "lockfile", file, message: "no 'packages' map; lockfile version 2 or 3 is required" },
    ];
  }
  const production: string[] = [];
  for (const [key, entry] of Object.entries(packages)) {
    if (key === "") continue;
    const name = key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);
    if (entry.link === true || !key.includes("node_modules/")) {
      problems.push({
        rule: "lockfile",
        file,
        message: `${key}: links and workspaces are not allowed`,
      });
      continue;
    }
    if (entry.resolved?.startsWith(REGISTRY) !== true) {
      problems.push({
        rule: "lockfile",
        file,
        message: `${key}: not resolved from the npm registry`,
      });
    }
    if (entry.integrity === undefined || entry.integrity === "") {
      problems.push({ rule: "lockfile", file, message: `${key}: no integrity hash` });
    }
    if (entry.dev !== true && entry.devOptional !== true) {
      production.push(name);
      if (entry.hasInstallScript === true) {
        problems.push({
          rule: "production-tree",
          file,
          message: `${name}: production dependency has an install script`,
        });
      }
    }
  }
  const allowed = new Set(allowedProduction);
  const actual = new Set(production);
  for (const name of actual) {
    if (!allowed.has(name)) {
      problems.push({
        rule: "production-tree",
        file,
        message: `${name}: not in the committed production dependency list (ask first)`,
      });
    }
  }
  for (const name of allowed) {
    if (!actual.has(name)) {
      problems.push({
        rule: "production-tree",
        file: "scripts/data/production-dependencies.json",
        message: `${name}: listed but not in the lockfile's production tree`,
      });
    }
  }
  return problems;
}
