import { parseArgs } from "node:util";
import { checkPathGuard } from "./checkers/path-guard.ts";
import { readJson, readText, report } from "./lib/repo.ts";

const { values } = parseArgs({
  options: {
    association: { type: "string" },
    action: { type: "string" },
    label: { type: "string" },
    files: { type: "string" },
    "changed-count": { type: "string" },
    labels: { type: "string" },
  },
});
const lines = (path: string | undefined) =>
  path === undefined
    ? []
    : readText(path)
        .split("\n")
        .filter((line) => line !== "");

const changedCount = Number(values["changed-count"]);
if (!Number.isInteger(changedCount)) {
  console.error("path-guard: --changed-count must be the pull request's number of changed files");
  process.exit(1);
}

report(
  "path-guard",
  checkPathGuard({
    association: values.association ?? "NONE",
    action: values.action ?? "",
    label: values.label ?? "maintainer-reviewed",
    files: lines(values.files),
    changedCount,
    labels: lines(values.labels),
    protectedPaths: readJson("scripts/data/protected-paths.json") as string[],
  }),
);
