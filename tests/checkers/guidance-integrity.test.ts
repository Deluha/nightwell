import { describe, expect, test } from "vitest";
import {
  anchors,
  checkGuidance,
  pathReferences,
  type GuidanceInput,
} from "../../scripts/checkers/guidance-integrity.ts";

const SKILL = ".claude/skills/nightwell-development/";
const base: Record<string, string> = {
  "CLAUDE.md": "# Contract\n\nSee `src/cli/` and `docs/threat-model.md#controls`.\n",
  [`${SKILL}SKILL.md`]: "| Task | File |\n|---|---|\n| Rules | `references/conventions.md` |\n",
  [`${SKILL}references/conventions.md`]: "## Hard rules\n\n### R1\n\ntext\n",
  ".claude/rules/source.md": "---\npaths:\n  - src/**\n---\n\nRead `CLAUDE.md`.\n",
  "docs/threat-model.md":
    "## Controls\n\n| # | Control | Test |\n|---|---|---|\n| C1 | x | `tests/a.test.ts` |\n",
  ".github/CODEOWNERS": "# owners\n/.claude/ @owner\n/scripts/ @owner\n",
  "src/cli/run.ts": "",
  "tests/a.test.ts": "",
};

function check(
  changes: Record<string, string | undefined> = {},
  futurePaths: Record<string, string> = {},
) {
  const merged = { ...base, ...changes };
  const texts = new Map<string, string>();
  for (const [path, text] of Object.entries(merged)) if (text !== undefined) texts.set(path, text);
  const input: GuidanceInput = {
    paths: [...texts.keys()],
    texts,
    futurePaths,
    protectedPaths: [".claude/", "scripts/"],
  };
  return checkGuidance(input).map((problem) => `${problem.rule}: ${problem.message}`);
}

test("a consistent tree passes", () => {
  expect(check()).toEqual([]);
});

describe("paths and anchors", () => {
  test("finds path-like tokens and ignores everything else", () => {
    const text = [
      "`src/a.ts` `README.md` `docs/x.md#top` `../up/file.json` `tests/`",
      "`auth.uid()` `npm run verify` `github.com/org/repo` `@babel/parser` `.ts` `a b/c` `--flag`",
      "```sh",
      "`in/fence.ts`",
      "```",
    ].join("\n");
    expect(pathReferences(text).map((reference) => reference.path)).toEqual([
      "src/a.ts",
      "README.md",
      "docs/x.md",
      "../up/file.json",
      "tests/",
    ]);
  });

  test("computes heading anchors", () => {
    expect([...anchors("# Hard rules\n## The `verify` command!\n```\n# not\n```")]).toEqual([
      "hard-rules",
      "the-verify-command",
    ]);
  });

  test("flags a missing path and a missing anchor", () => {
    expect(check({ "CLAUDE.md": "`src/nope.ts` and `docs/threat-model.md#nope`\n" })).toEqual([
      "path: 'src/nope.ts' does not exist",
      "anchor: 'docs/threat-model.md#nope' has no such heading",
    ]);
  });

  test("checks anchors into any Markdown file and into the citing file itself", () => {
    const readme = { "README.md": "# Title\n\n## What it is\n" };
    expect(
      check({ ...readme, "CLAUDE.md": "`README.md#what-it-is` and `#top`\n\n## Top\n" }),
    ).toEqual([]);
    expect(check({ ...readme, "CLAUDE.md": "`README.md#nope` and `#gone`\n" })).toEqual([
      "anchor: 'README.md#nope' has no such heading",
      "anchor: '#gone' has no such heading in this file",
    ]);
  });

  test("resolves relative to the citing file", () => {
    expect(check({ [`${SKILL}references/conventions.md`]: "### R1\n\n`../SKILL.md`\n" })).toEqual(
      [],
    );
  });

  test("accepts a future path, and fails once it exists", () => {
    const claude = { "CLAUDE.md": "`src/engine/` and `src/cli/`\n" };
    expect(check(claude, { "src/engine/": "Phase 2" })).toEqual([]);
    expect(check(claude, { "src/cli/": "Phase 0" })).toEqual([
      "future-path: 'src/cli/' (Phase 0) now exists; remove its entry",
      "path: 'src/engine/' does not exist",
    ]);
  });
});

test("enforces the CLAUDE.md budget", () => {
  expect(check({ "CLAUDE.md": "line\n".repeat(81) })[0]).toMatch(/^budget: 81 lines/);
  expect(check({ "CLAUDE.md": "x".repeat(8193) })[0]).toMatch(/^budget: 1 lines and 8193 bytes/);
  expect(check({ "CLAUDE.md": undefined })).toContain("budget: is missing");
});

test("requires exactly one routing row per skill file", () => {
  expect(check({ [`${SKILL}references/style.md`]: "# Style\n" })).toEqual([
    "routing: 'references/style.md' has 0 routing rows; it needs exactly one",
  ]);
  const twice = `${base[`${SKILL}SKILL.md`]}| Again | \`references/conventions.md\` |\n`;
  expect(check({ [`${SKILL}SKILL.md`]: twice })).toHaveLength(1);
});

test("a rule heading has one home", () => {
  expect(check({ ".claude/agents/a.md": "### R1\n" })[0]).toMatch(
    /^one-home: heading R1 appears 2 times/,
  );
});

test("path rules and command skills stay pointer-only", () => {
  const long = `---\nname: x\n---\n\n${"line\n".repeat(7)}`;
  expect(check({ ".claude/rules/source.md": long })).toEqual([
    "pointer-only: 7 body lines; a pointer file has at most 6",
  ]);
  expect(check({ ".claude/skills/verify/SKILL.md": long })).toHaveLength(1);
});

test("every control in the threat model names an existing test", () => {
  const table =
    "## Controls\n\n| C1 | x | none |\n| C2 | y | `tests/gone.test.ts` |\n\n## Other\n| C3 | z | |\n";
  expect(check({ "docs/threat-model.md": table, "CLAUDE.md": "x\n" })).toEqual([
    "threat-model: control names no test",
    "threat-model: control names a test that does not exist: tests/gone.test.ts",
  ]);
  expect(check({ "docs/threat-model.md": "## Controls\n", "CLAUDE.md": "x\n" })).toEqual([
    "threat-model: has no control rows (C<n>)",
  ]);
  expect(check({ "docs/threat-model.md": undefined, "CLAUDE.md": "x\n" })).toEqual([
    "threat-model: is missing",
  ]);
  expect(
    check(
      { "docs/threat-model.md": undefined, "CLAUDE.md": "x\n" },
      { "docs/threat-model.md": "P0" },
    ),
  ).toEqual([]);
});

test("protected paths need a code-owner entry", () => {
  expect(check({ ".github/CODEOWNERS": "/.claude/ @owner\n/scripts/\n" })).toEqual([
    "code-owners: protected path '/scripts/' has no owner entry",
  ]);
  expect(check({ ".github/CODEOWNERS": undefined })).toEqual(["code-owners: is missing"]);
  expect(check({ ".github/CODEOWNERS": undefined }, { ".github/CODEOWNERS": "P0" })).toEqual([]);
});
