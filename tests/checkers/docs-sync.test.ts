import { expect, test } from "vitest";
import { checkDocsSync } from "../../scripts/checkers/docs-sync.ts";

const map = [{ area: ["scripts/checkers/**", "scripts/verify.ts"], doc: "docs/checkers.md" }];
const code = "scripts/checkers/a.ts";

test("passes when no documented area changed", () => {
  expect(checkDocsSync([{ message: "x", files: ["src/a.ts"] }], map)).toEqual([]);
});

test("fails when an area changed without its document", () => {
  const problems = checkDocsSync([{ message: "x", files: [code] }], map);
  expect(problems).toHaveLength(1);
  expect(problems[0]).toMatchObject({ rule: "R7", file: code });
});

test("passes when the document changes anywhere in the range", () => {
  const commits = [
    { message: "code", files: [code] },
    { message: "docs", files: ["docs/checkers.md"] },
  ];
  expect(checkDocsSync(commits, map)).toEqual([]);
});

test("honours [skip-docs] only on its own line and only if every touching commit has it", () => {
  const skipped = { message: "fix typo\n\n[skip-docs]\n", files: [code] };
  expect(checkDocsSync([skipped], map)).toEqual([]);
  expect(
    checkDocsSync([{ message: "mention [skip-docs] inline", files: [code] }], map),
  ).toHaveLength(1);
  expect(
    checkDocsSync([skipped, { message: "more", files: ["scripts/verify.ts"] }], map),
  ).toHaveLength(1);
});
