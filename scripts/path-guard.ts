import { parseArgs } from "node:util";
import { checkPathGuard } from "./checkers/path-guard.ts";
import { readJson, readText, report } from "./lib/repo.ts";

const { values } = parseArgs({
  options: {
    association: { type: "string" },
    label: { type: "string" },
    files: { type: "string" },
    labels: { type: "string" },
  },
});
const lines = (path: string | undefined) =>
  path === undefined
    ? []
    : readText(path)
        .split("\n")
        .filter((line) => line !== "");

report(
  "path-guard",
  checkPathGuard({
    association: values.association ?? "NONE",
    label: values.label ?? "maintainer-reviewed",
    files: lines(values.files),
    labels: lines(values.labels),
    protectedPaths: readJson("scripts/data/protected-paths.json") as string[],
  }),
);
