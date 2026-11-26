// Decides whether a pull request may touch protected paths.
import { matchesGlob } from "../lib/glob.ts";
import type { Problem } from "../lib/problem.ts";

export interface PathGuardInput {
  /** The author's association with the repository, as the code host reports it. */
  association: string;
  /** The event action that started the run, e.g. `opened`, `synchronize`, `labeled`. */
  action: string;
  /** The changed files the code host listed. */
  files: readonly string[];
  /** How many files the pull request changes, as the event reports it. */
  changedCount: number;
  labels: readonly string[];
  protectedPaths: readonly string[];
  /** The label a maintainer applies after reading the diff on the code host. */
  label: string;
}

const MAINTAINERS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);
/** The code host lists at most this many files of a pull request. */
export const LISTING_LIMIT = 3000;

export function checkPathGuard(input: PathGuardInput): Problem[] {
  if (MAINTAINERS.has(input.association)) return [];
  const labelled = input.labels.includes(input.label);

  // A new push must be read again: the label has to be gone by now.
  if (input.action === "synchronize" && labelled) {
    return [
      {
        rule: "path-guard",
        message: `'${input.label}' is still set after a new push; remove it, read the new revision, and apply it again`,
      },
    ];
  }
  if (labelled) return [];

  // A listing that may be incomplete cannot show that no protected path changed.
  if (input.changedCount >= LISTING_LIMIT || input.files.length < input.changedCount) {
    return [
      {
        rule: "path-guard",
        message: `the file listing may be incomplete (${input.files.length} listed, ${input.changedCount} changed); a maintainer reads the diff and applies '${input.label}'`,
      },
    ];
  }
  return input.files
    .filter((file) => input.protectedPaths.some((path) => matchesGlob(file, path)))
    .map((file) => ({
      rule: "path-guard",
      file,
      message: `protected path changed by an outside contributor; a maintainer reads the diff and applies '${input.label}'`,
    }));
}
