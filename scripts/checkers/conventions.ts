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
/** Names that may not be referenced or bound outside src/cli/: the two globals and the global object. */
const RESERVED_OUTSIDE_CLI = new Set(["console", "process", "globalThis", "global"]);
const CLI_ONLY_MODULES = new Set(["process", "node:process", "console", "node:console"]);
const MEMBER_TYPES = new Set(["MemberExpression", "OptionalMemberExpression"]);
/** Type-only wrappers around an expression, which do not change what it names. */
const WRAPPER_TYPES = new Set([
  "TSNonNullExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "ParenthesizedExpression",
]);
const MODULE_SOURCE_TYPES = new Set([
  "ImportDeclaration",
  "ImportExpression",
  "ExportAllDeclaration",
  "ExportNamedDeclaration",
]);
/** Positions where an identifier names something else than a binding or a reference to it. */
const NAME_ONLY_KEYS: Readonly<Record<string, readonly string[]>> = {
  ImportSpecifier: ["imported"],
  ExportSpecifier: ["exported"],
  TSEnumMember: ["id"],
};

function isNode(value: unknown): value is Node {
  return typeof value === "object" && value !== null && typeof (value as Node).type === "string";
}

type Visit = (node: Node, parent: Node | undefined, key: string) => void;

function walk(node: Node, visit: Visit, parent?: Node, parentKey = ""): void {
  visit(node, parent, parentKey);
  for (const [key, value] of Object.entries(node)) {
    if (key === "loc" || key === "range") continue;
    for (const child of Array.isArray(value) ? value : [value]) {
      if (isNode(child)) walk(child, visit, node, key);
    }
  }
}

/** The property name of a member access, for `a.b`, `a?.b` and `a["b"]`. */
function memberProperty(node: Node): string | undefined {
  const property = node["property"] as Node;
  if (node["computed"] !== true) {
    return property.type === "Identifier" ? (property["name"] as string) : undefined;
  }
  return literalValue(property);
}

/** Renders `a.b.c` for a member chain of plain identifiers, else undefined. */
function qualifiedName(node: Node): string | undefined {
  if (WRAPPER_TYPES.has(node.type)) return qualifiedName(node["expression"] as Node);
  if (node.type === "Identifier") return node["name"] as string;
  if (node.type === "TSQualifiedName") {
    const left = qualifiedName(node["left"] as Node);
    const right = qualifiedName(node["right"] as Node);
    return left !== undefined && right !== undefined ? `${left}.${right}` : undefined;
  }
  if (!MEMBER_TYPES.has(node.type)) return undefined;
  const object = qualifiedName(node["object"] as Node);
  const property = memberProperty(node);
  return object !== undefined && property !== undefined ? `${object}.${property}` : undefined;
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

    walk(ast, (node, parent, key) => {
      if (node.type === "Identifier" || node.type === "PrivateName") {
        const name = typeof node["name"] === "string" ? node["name"] : "";
        if (name.toLowerCase().includes(platform)) {
          add("R2", node, `identifier '${name}' contains the platform's name`);
        }
        // A reference or a binding, not a name in a position that cannot be the global:
        // `x.process`, `{ process: 1 }`, `#process`, `import { process as run }`.
        const isNameOnly =
          node.type === "PrivateName" ||
          (parent !== undefined &&
            ((parent["computed"] !== true &&
              ((key === "property" && MEMBER_TYPES.has(parent.type)) || key === "key")) ||
              (NAME_ONLY_KEYS[parent.type]?.includes(key) ?? false) ||
              parent.type === "PrivateName"));
        if (!inCli && RESERVED_OUTSIDE_CLI.has(name) && !isNameOnly) {
          add("cli-boundary", node, `${name} is reserved for src/cli/`);
        }
      }
      if (MEMBER_TYPES.has(node.type) || node.type === "TSQualifiedName") {
        const name = qualifiedName(node);
        if (name !== undefined && isForbidden(name)) {
          add("R2", node, `qualified name '${name}' belongs in the rule pack`);
        }
      }
      if (MODULE_SOURCE_TYPES.has(node.type) && !inCli && isNode(node["source"])) {
        const source = literalValue(node["source"]);
        if (source !== undefined && CLI_ONLY_MODULES.has(source)) {
          add("cli-boundary", node, `'${source}' is imported outside src/cli/`);
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
const TEST_FILES = ["**/*.test.*", "**/*.spec.*", "**/__tests__/**"];
const MARKDOWN = /\.(md|mdx|markdown)$/;

/** R8 and the tracked-file rules, over the list of files in the working tree. */
export function checkFiles(paths: readonly string[], permanentDocs: readonly string[]): Problem[] {
  const problems: Problem[] = [];
  for (const file of paths) {
    // Rules match on the lower-cased path; the permanent docs list is exact.
    const lower = file.toLowerCase();
    if (matchesAny(lower, BUILD_ARTIFACTS)) {
      problems.push({ rule: "no-artifact", file, message: "build artifact must not be tracked" });
    }
    if (matchesAny(lower, SECRET_FILES) && !matchesAny(lower, SECRET_FILE_EXCEPTIONS)) {
      problems.push({ rule: "no-secret-file", file, message: "secret file must not be tracked" });
    }
    if (matchesAny(lower, TEST_FILES) && !file.startsWith("tests/")) {
      problems.push({ rule: "R8", file, message: "tests live only in tests/" });
    }
    if (MARKDOWN.test(lower) && !matchesAny(file, permanentDocs)) {
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
