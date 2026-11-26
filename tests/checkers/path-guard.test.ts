import { expect, test } from "vitest";
import { LISTING_LIMIT, checkPathGuard } from "../../scripts/checkers/path-guard.ts";

const base = {
  association: "CONTRIBUTOR",
  action: "opened",
  files: ["src/a.ts", ".github/workflows/ci.yml", "scripts/verify.ts", "CLAUDE.md"],
  changedCount: 4,
  labels: [] as string[],
  protectedPaths: [".github/", "scripts/", "CLAUDE.md"],
  label: "maintainer-reviewed",
};
const reviewed = ["maintainer-reviewed"];

test("an outside pull request touching protected paths fails until labelled", () => {
  expect(checkPathGuard(base).map((problem) => problem.file)).toEqual([
    ".github/workflows/ci.yml",
    "scripts/verify.ts",
    "CLAUDE.md",
  ]);
  expect(checkPathGuard({ ...base, action: "labeled", labels: reviewed })).toEqual([]);
  expect(
    checkPathGuard({ ...base, association: "FIRST_TIME_CONTRIBUTOR", labels: ["bug"] }),
  ).toHaveLength(3);
});

test("maintainers and unprotected changes pass", () => {
  expect(checkPathGuard({ ...base, association: "OWNER" })).toEqual([]);
  expect(checkPathGuard({ ...base, files: ["src/a.ts", "README.md"], changedCount: 2 })).toEqual(
    [],
  );
});

test("a label that survives a new push fails instead of approving the unread revision", () => {
  const problems = checkPathGuard({ ...base, action: "synchronize", labels: reviewed });
  expect(problems).toHaveLength(1);
  expect(problems[0]?.message).toContain("still set after a new push");
  expect(
    checkPathGuard({ ...base, action: "synchronize", files: ["src/a.ts"], changedCount: 1 }),
  ).toEqual([]);
});

test("an incomplete file listing fails closed", () => {
  const harmless = { ...base, files: ["src/a.ts"] };
  expect(checkPathGuard({ ...harmless, changedCount: 2 })[0]?.message).toContain(
    "may be incomplete",
  );
  expect(checkPathGuard({ ...harmless, changedCount: LISTING_LIMIT })).toHaveLength(1);
  expect(checkPathGuard({ ...harmless, changedCount: LISTING_LIMIT, labels: reviewed })).toEqual(
    [],
  );
  expect(checkPathGuard({ ...harmless, changedCount: 1 })).toEqual([]);
});
