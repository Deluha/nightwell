import { expect, test } from "vitest";
import { checkPathGuard } from "../../scripts/checkers/path-guard.ts";

const base = {
  association: "CONTRIBUTOR",
  files: ["src/a.ts", ".github/workflows/ci.yml", "scripts/verify.ts", "CLAUDE.md"],
  labels: [],
  protectedPaths: [".github/", "scripts/", "CLAUDE.md"],
  label: "maintainer-reviewed",
};

test("an outside pull request touching protected paths fails until labelled", () => {
  expect(checkPathGuard(base).map((problem) => problem.file)).toEqual([
    ".github/workflows/ci.yml",
    "scripts/verify.ts",
    "CLAUDE.md",
  ]);
  expect(checkPathGuard({ ...base, labels: ["maintainer-reviewed"] })).toEqual([]);
  expect(
    checkPathGuard({ ...base, association: "FIRST_TIME_CONTRIBUTOR", labels: ["bug"] }),
  ).toHaveLength(3);
});

test("maintainers and unprotected changes pass", () => {
  expect(checkPathGuard({ ...base, association: "OWNER" })).toEqual([]);
  expect(checkPathGuard({ ...base, files: ["src/a.ts", "README.md"] })).toEqual([]);
});
