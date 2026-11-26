import { describe, expect, test } from "vitest";
import {
  checkFiles,
  checkLockfile,
  checkSource,
  parsePermanentDocs,
} from "../../scripts/checkers/conventions.ts";

const forbidden = {
  platformName: "supabase",
  exempt: ["auth"],
  identifiers: ["auth.uid", "service_role", "/rest/v1", "auth"],
};
const rules = (path: string, text: string) =>
  checkSource([{ path, text }], forbidden).map((problem) => problem.rule);

describe("checkSource", () => {
  test("accepts ordinary code", () => {
    expect(rules("src/engine/a.ts", "export const area = 'auth';\nconst x: number = 1;")).toEqual(
      [],
    );
  });

  test("flags identifiers that contain the platform's name", () => {
    expect(rules("src/a.ts", "const supabaseClient = 1;")).toEqual(["R2"]);
    expect(rules("src/a.ts", "function isSupabase() {}")).toEqual(["R2"]);
  });

  test("flags qualified names and whole string literals from the list", () => {
    expect(rules("src/a.ts", "x(auth.uid);")).toEqual(["R2"]);
    expect(rules("src/a.ts", "const r = 'service_role';")).toEqual(["R2"]);
    expect(rules("src/a.ts", "const p = `/rest/v1`;")).toEqual(["R2"]);
  });

  test("does not flag a literal that only mentions an identifier", () => {
    expect(rules("src/a.ts", "const help = 'grants to service_role are listed';")).toEqual([]);
  });

  test("keeps process and console inside src/cli/", () => {
    expect(rules("src/engine/a.ts", "console.log(1); process.exit(1); process.env.X;")).toEqual([
      "cli-boundary",
      "cli-boundary",
      "cli-boundary",
    ]);
    expect(rules("src/cli/run.ts", "process.stdout.write('x'); process.exitCode = 1;")).toEqual([]);
    expect(rules("src/cli/run.ts", "import process from 'node:process'; console.log(1);")).toEqual(
      [],
    );
  });

  test.each([
    "const { log } = console; log(1);",
    "const c = console; c.log(1);",
    "globalThis.console.log(1);",
    "globalThis['process'].exit(1);",
    "process['exit'](1);",
    "const { env, exit } = process;",
    "import { env } from 'node:process';",
    "const p = await import('process');",
    "process?.exit(1);",
    "process.versions.node;",
    "export * from 'node:process';",
    "export { env } from 'node:process';",
    "const { console: c } = globalThis; c.log(1);",
    "const g = globalThis; g.process.exit(1);",
    "(globalThis as any).process.exit(1);",
    "function process(item: number) { return item; }",
  ])("catches an indirect use outside src/cli/: %s", (code) => {
    expect(rules("src/engine/a.ts", code)).toContain("cli-boundary");
  });

  test.each([
    "const o = { process: 1, console: 2 }; o.process; o.console;",
    "class A { #process = 1; process() { return this.#process; } }",
    "import { process as run } from './x.ts'; run();",
    "export { run as process } from './x.ts';",
    "enum E { process }",
    "export { a } from './x.ts'; export const b = 1;",
  ])("does not mistake a name-only position for the global: %s", (code) => {
    expect(rules("src/engine/a.ts", code)).toEqual([]);
  });

  test("flags qualified names through optional chaining, computed access and types", () => {
    expect(rules("src/a.ts", "x(auth?.uid);")).toEqual(["R2"]);
    expect(rules("src/a.ts", "x(auth['uid']);")).toEqual(["R2"]);
    expect(rules("src/a.ts", "type A = auth.uid;")).toEqual(["R2"]);
    expect(rules("src/a.ts", "x(auth!.uid); x((auth as any).uid);")).toEqual(["R2", "R2"]);
  });

  test("reports a file that cannot be parsed and a fat entry file", () => {
    expect(rules("src/a.ts", "const = ;")).toEqual(["parse"]);
    expect(rules("src/cli/main.ts", "f();\n".repeat(41))).toEqual(["thin-entry"]);
    expect(rules("src/cli/commands/audit.ts", "f();\n\n".repeat(40))).toEqual([]);
  });
});

describe("checkFiles", () => {
  const docs = parsePermanentDocs("x\n```permanent-docs\nREADME.md\n\n.claude/**\n```\n");

  test("reads the permanent-docs block", () => {
    expect(docs).toEqual(["README.md", ".claude/**"]);
    expect(parsePermanentDocs("no block")).toEqual([]);
  });

  test("accepts listed Markdown and ordinary files", () => {
    expect(
      checkFiles(["README.md", ".claude/rules/a.md", "src/a.ts", ".env.example"], docs),
    ).toEqual([]);
  });

  test("flags stray Markdown, tests outside tests/, artifacts and secret files", () => {
    const found = checkFiles(
      [
        "PLAN.md",
        "docs/notes.MD",
        "notes.mdx",
        "PLAN.markdown",
        ".claude/notes/plan.md",
        "src/a.test.ts",
        "src/a.test.tsx",
        "src/__tests__/a.ts",
        "dist/index.js",
        ".env",
        "fixture/.env.local",
        "x/.ENV",
        "a/key.PEM",
      ],
      ["README.md", ".claude/rules/*.md"],
    );
    expect(found.map((problem) => `${problem.rule} ${problem.file}`)).toEqual([
      "R8 PLAN.md",
      "R8 docs/notes.MD",
      "R8 notes.mdx",
      "R8 PLAN.markdown",
      "R8 .claude/notes/plan.md",
      "R8 src/a.test.ts",
      "R8 src/a.test.tsx",
      "R8 src/__tests__/a.ts",
      "no-artifact dist/index.js",
      "no-secret-file .env",
      "no-secret-file fixture/.env.local",
      "no-secret-file x/.ENV",
      "no-secret-file a/key.PEM",
    ]);
  });
});

describe("checkLockfile", () => {
  const entry = { resolved: "https://registry.npmjs.org/a/-/a-1.0.0.tgz", integrity: "sha512-x" };
  const lock = (packages: Record<string, unknown>) => ({ packages: { "": {}, ...packages } });
  const messages = (packages: Record<string, unknown>, allowed: string[] = []) =>
    checkLockfile(lock(packages), allowed).map((problem) => problem.message);

  test("accepts a development-only tree from the registry", () => {
    expect(messages({ "node_modules/a": { ...entry, dev: true, hasInstallScript: true } })).toEqual(
      [],
    );
    expect(messages({ "node_modules/a": { ...entry, devOptional: true } })).toEqual([]);
  });

  test("flags entries without integrity or from another source", () => {
    expect(
      messages({
        "node_modules/a": { resolved: "git+https://example.test/a.git", dev: true },
        "node_modules/b": { link: true },
        "packages/c": { dev: true },
      }),
    ).toEqual([
      "node_modules/a: not resolved from the npm registry",
      "node_modules/a: no integrity hash",
      "node_modules/b: links and workspaces are not allowed",
      "packages/c: links and workspaces are not allowed",
    ]);
  });

  test("compares the production tree with the committed list", () => {
    const packages = {
      "node_modules/a": entry,
      "node_modules/a/node_modules/@s/b": { ...entry, hasInstallScript: true },
    };
    expect(messages(packages, ["a", "gone"])).toEqual([
      "@s/b: production dependency has an install script",
      "@s/b: not in the committed production dependency list (ask first)",
      "gone: listed but not in the lockfile's production tree",
    ]);
    expect(messages({ "node_modules/a": entry }, ["a"])).toEqual([]);
  });

  test("rejects an old lockfile format", () => {
    expect(checkLockfile({ dependencies: {} }, [])).toHaveLength(1);
  });
});
