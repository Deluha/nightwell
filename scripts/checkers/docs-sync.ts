// R7: a change in a documented area touches that area's document.
import { matchesAny } from "../lib/glob.ts";
import type { Problem } from "../lib/problem.ts";

export interface Commit {
  message: string;
  files: readonly string[];
}

export interface DocsMapEntry {
  area: readonly string[];
  doc: string;
}

const SKIP = /^\[skip-docs\]\s*$/m;

/**
 * Checks a range of commits (a pull request, or the commits since the base plus
 * the one being written). The document may change in any commit of the range.
 */
export function checkDocsSync(commits: readonly Commit[], map: readonly DocsMapEntry[]): Problem[] {
  const problems: Problem[] = [];
  for (const entry of map) {
    const touching = commits.filter((commit) =>
      commit.files.some((file) => matchesAny(file, entry.area)),
    );
    if (touching.length === 0) continue;
    if (commits.some((commit) => commit.files.includes(entry.doc))) continue;
    if (touching.every((commit) => SKIP.test(commit.message))) continue;
    const example = touching[0]?.files.find((file) => matchesAny(file, entry.area)) ?? "";
    problems.push({
      rule: "R7",
      file: example,
      message: `changes in ${entry.area.join(", ")} need an update of ${entry.doc} (or [skip-docs] on its own line)`,
    });
  }
  return problems;
}
