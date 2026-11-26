import { parseArgs } from "node:util";
import { checkPathGuard } from "./checkers/path-guard.ts";
import { readJson, readText, report } from "./lib/repo.ts";

const { values } = parseArgs({
  options: {
    association: { type: "string" },
    action: { type: "string" },
    label: { type: "string" },
    files: { type: "string" },
    "previous-files": { type: "string" },
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

const changed = values["changed-count"] ?? "";
if (!/^\d+$/.test(changed) || values.action === undefined || values.action === "") {
  console.error("path-guard: --changed-count (a number) and --action are required");
  process.exit(1);
}

report(
  "path-guard",
  checkPathGuard({
    association: values.association ?? "NONE",
    action: values.action,
    label: values.label ?? "maintainer-reviewed",
    files: lines(values.files),
    previousFiles: lines(values["previous-files"]),
    changedCount: Number(changed),
    labels: lines(values.labels),
    protectedPaths: readJson("scripts/data/protected-paths.json") as string[],
  }),
);
