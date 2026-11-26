// Decides whether a pull request may touch protected paths.
import { matchesGlob } from "../lib/glob.ts";
import type { Problem } from "../lib/problem.ts";

export interface PathGuardInput {
  /** The author's association with the repository, as the code host reports it. */
  association: string;
  files: readonly string[];
  labels: readonly string[];
  protectedPaths: readonly string[];
  /** The label a maintainer applies after reading the diff on the code host. */
  label: string;
}

const MAINTAINERS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

export function checkPathGuard(input: PathGuardInput): Problem[] {
  if (MAINTAINERS.has(input.association) || input.labels.includes(input.label)) return [];
  return input.files
    .filter((file) => input.protectedPaths.some((path) => matchesGlob(file, path)))
    .map((file) => ({
      rule: "path-guard",
      file,
      message: `protected path changed by an outside contributor; a maintainer reads the diff and applies '${input.label}'`,
    }));
}
