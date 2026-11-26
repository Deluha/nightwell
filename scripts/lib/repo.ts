// Reads the working tree for the checker wrappers. The checkers themselves are
// pure and take what this module returns.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { formatProblem, type Problem } from "./problem.ts";

export function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Tracked files plus untracked files that are not ignored, as POSIX paths. */
export function listFiles(): string[] {
  return git("ls-files", "--cached", "--others", "--exclude-standard", "-z")
    .split("\0")
    .filter((path) => path !== "" && existsSync(path));
}

export function readText(path: string): string {
  return readFileSync(path, "utf8");
}

export function readJson(path: string): unknown {
  return JSON.parse(readText(path));
}

/** Prints the problems and sets the exit code; the last step of every wrapper. */
export function report(name: string, problems: readonly Problem[]): void {
  for (const problem of problems) console.error(formatProblem(problem));
  if (problems.length > 0) {
    console.error(`${name}: ${problems.length} problem(s)`);
    process.exitCode = 1;
  } else {
    console.log(`${name}: ok`);
  }
}
