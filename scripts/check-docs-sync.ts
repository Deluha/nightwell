// Usage:
//   node scripts/check-docs-sync.ts [--base <ref>] [--message-file <path>]
// Checks the commits since the base (default: the merge base with the default
// branch) together with the work not yet committed.
import { parseArgs } from "node:util";
import { checkDocsSync, type Commit, type DocsMapEntry } from "./checkers/docs-sync.ts";
import { git, readJson, readText, report } from "./lib/repo.ts";

const { values } = parseArgs({
  options: { base: { type: "string" }, "message-file": { type: "string" } },
});

function resolveBase(): string | undefined {
  for (const ref of [values.base, "origin/main", "main"]) {
    if (ref === undefined) continue;
    try {
      return git("merge-base", ref, "HEAD").trim();
    } catch {
      // The ref does not exist in this checkout; try the next one.
    }
  }
  return undefined;
}

function commitsSince(base: string | undefined): Commit[] {
  const range = base === undefined ? ["-1", "HEAD"] : [`${base}..HEAD`];
  const log = git("log", "--no-merges", "--name-only", "--format=%x00%B%x01", ...range);
  return log
    .split("\0")
    .filter((record) => record.trim() !== "")
    .map((record) => {
      const [message = "", files = ""] = record.split("\u0001");
      return { message, files: lines(files) };
    });
}

const lines = (text: string) => text.split("\n").filter((line) => line !== "");

// The work not yet committed counts as one more commit: with the message being
// written (commit-msg hook), or with no message (verify on a working tree).
const commits = commitsSince(resolveBase());
const messageFile = values["message-file"];
commits.push(
  messageFile === undefined
    ? {
        message: "",
        files: [
          ...lines(git("diff", "--name-only", "HEAD")),
          ...lines(git("ls-files", "--others", "--exclude-standard")),
        ],
      }
    : { message: readText(messageFile), files: lines(git("diff", "--cached", "--name-only")) },
);

report(
  "check-docs-sync",
  checkDocsSync(commits, readJson("scripts/data/docs-map.json") as DocsMapEntry[]),
);
