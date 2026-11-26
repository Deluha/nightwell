import {
  checkFiles,
  checkLockfile,
  checkSource,
  parsePermanentDocs,
  type ForbiddenList,
} from "./checkers/conventions.ts";
import { listFiles, readJson, readText, report } from "./lib/repo.ts";

const CONVENTIONS = ".claude/skills/nightwell-development/references/conventions.md";

const files = listFiles();
const sources = files
  .filter((path) => path.startsWith("src/") && path.endsWith(".ts"))
  .map((path) => ({ path, text: readText(path) }));

report("check-conventions", [
  ...checkSource(sources, readJson("scripts/data/forbidden-identifiers.json") as ForbiddenList),
  ...checkFiles(files, parsePermanentDocs(readText(CONVENTIONS))),
  ...checkLockfile(
    readJson("package-lock.json"),
    readJson("scripts/data/production-dependencies.json") as string[],
  ),
]);
