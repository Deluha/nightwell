// Lints the file an edit just touched and feeds failures back to the session:
// exit code 2 hands standard error to the model.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
let file;
try {
  file = JSON.parse(readFileSync(0, "utf8")).tool_input?.file_path;
} catch {
  process.exit(0);
}
if (typeof file !== "string") process.exit(0);

const relative = path.relative(root, path.resolve(root, file));
const inside = !relative.startsWith("..") && !path.isAbsolute(relative);
if (!inside || !existsSync(path.join(root, relative))) process.exit(0);

const run = (script, args) =>
  spawnSync(process.execPath, [path.join(root, "node_modules", script), ...args], {
    cwd: root,
    encoding: "utf8",
  });

const failures = [];
if (/\.(ts|js)$/.test(relative)) {
  const lint = run("eslint/bin/eslint.js", [relative]);
  if (lint.status !== 0) failures.push(lint.stdout + lint.stderr);
}
if (/\.(ts|js|json|md|ya?ml)$/.test(relative)) {
  const format = run("prettier/bin/prettier.cjs", ["--check", relative]);
  if (format.status === 1) failures.push(`${relative}: not formatted; run 'npm run format'`);
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exit(2);
}
