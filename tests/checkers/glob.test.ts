import { expect, test } from "vitest";
import { matchesAny, matchesGlob } from "../../scripts/lib/glob.ts";
import { formatProblem } from "../../scripts/lib/problem.ts";

test("matches simple globs", () => {
  expect(matchesGlob("src/a.ts", "src/*.ts")).toBe(true);
  expect(matchesGlob("src/b/a.ts", "src/*.ts")).toBe(false);
  expect(matchesGlob("src/b/c/a.ts", "src/**")).toBe(true);
  expect(matchesGlob("src", "src/**")).toBe(false);
  expect(matchesGlob("a.md", "**/*.md")).toBe(true);
  expect(matchesGlob("x/y/a.md", "**/*.md")).toBe(true);
  expect(matchesGlob("x/.env.local", "**/.env.*")).toBe(true);
  expect(matchesGlob(".claude/rules/a.md", ".claude/")).toBe(true);
  expect(matchesGlob("READMEXmd", "README.md")).toBe(false);
  expect(matchesAny("a/b", ["c", "a/*"])).toBe(true);
});

test("formats a problem with and without a location", () => {
  expect(formatProblem({ rule: "R8", message: "m" })).toBe("m [R8]");
  expect(formatProblem({ rule: "R8", message: "m", file: "a.md" })).toBe("a.md: m [R8]");
  expect(formatProblem({ rule: "R8", message: "m", file: "a.ts", line: 3 })).toBe("a.ts:3: m [R8]");
});
