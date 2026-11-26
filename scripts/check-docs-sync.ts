// Usage:
//   node scripts/check-docs-sync.ts [--base <ref>] [--message-file <path>]
// Checks the commits since the base (default: the merge base with the default
// branch) together with the work not yet committed.
import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";
import { checkDocsSync, type Commit, type DocsMapEntry } from "./checkers/docs-sync.ts";
import { git, readJson, readText, report } from "./lib/repo.ts";

const { values } = parseArgs({
  options: { base: { type: "string" }, "message-file": { type: "string" } },
});

function mergeBase(ref: string): string | undefined {
  try {
    return execFileSync("git", ["merge-base", ref, "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

/** A base given explicitly must resolve: a gate never falls back silently. */
function resolveBase(): string | undefined {
  if (values.base !== undefined) {
    const base = mergeBase(values.base);
    if (base === undefined) {
      console.error(
        `check-docs-sync: base '${values.base}' cannot be resolved (shallow checkout?)`,
      );
      process.exit(1);
    }
    return base;
  }
  return mergeBase("origin/main") ?? mergeBase("main");
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
