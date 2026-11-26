// Keeps the guidance consistent with the tree. What it parses and enforces is
// listed in the skill's checkers reference.
import { posix } from "node:path";
import type { Problem } from "../lib/problem.ts";

export interface GuidanceInput {
  /** Every file in the working tree, POSIX-style. */
  paths: readonly string[];
  /** Text of the files the checker reads; a path missing here is treated as absent. */
  texts: ReadonlyMap<string, string>;
  /** Paths named for phases not yet built, with the phase that creates each. */
  futurePaths: Readonly<Record<string, string>>;
  protectedPaths: readonly string[];
}

export const CLAUDE_MD = "CLAUDE.md";
export const SKILL_DIR = ".claude/skills/nightwell-development/";
export const THREAT_MODEL = "docs/threat-model.md";
export const CODEOWNERS = ".github/CODEOWNERS";
const MAX_LINES = 80;
const MAX_BYTES = 8 * 1024;
const POINTER_MAX_LINES = 6;
const FILE_EXTENSIONS = /[\w-]\.(md|json|ts|js|sh|ya?ml|toml|sql)$/;
const PATH_SHAPE = /^(\.{1,2}\/)*[\w.@-]+(\/[\w.@-]+)*\/?$/;
const HOST_SHAPE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function isGuidance(path: string): boolean {
  return path === CLAUDE_MD || (path.startsWith(".claude/") && path.endsWith(".md"));
}

/** GitHub-style heading anchors of a Markdown text. */
export function anchors(markdown: string): Set<string> {
  const result = new Set<string>();
  for (const line of stripFences(markdown)) {
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (heading?.[1] === undefined) continue;
    result.add(
      heading[1]
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N} _-]/gu, "")
        .replace(/ /g, "-"),
    );
  }
  return result;
}

/** The lines of a Markdown text with fenced code blocks blanked out. */
function stripFences(markdown: string): string[] {
  let fenced = false;
  return markdown.split("\n").map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fenced = !fenced;
      return "";
    }
    return fenced ? "" : line;
  });
}

function body(markdown: string): string[] {
  const withoutFrontmatter = markdown.replace(/^---\n[\s\S]*?\n---\n/, "");
  return withoutFrontmatter.split("\n").filter((line) => line.trim() !== "");
}

interface Reference {
  path: string;
  anchor: string | undefined;
  line: number;
}

/** Backticked tokens that look like repository paths, outside fenced blocks. */
export function pathReferences(markdown: string): Reference[] {
  const references: Reference[] = [];
  stripFences(markdown).forEach((line, index) => {
    for (const match of line.matchAll(/`([^`\n]+)`/g)) {
      const [target = "", anchor] = (match[1] ?? "").split("#", 2);
      if (!PATH_SHAPE.test(target) || target.startsWith("@")) continue;
      if (!target.includes("/") && !FILE_EXTENSIONS.test(target)) continue;
      const first = target.split("/")[0] ?? "";
      if (target.includes("/") && HOST_SHAPE.test(first) && !FILE_EXTENSIONS.test(first)) continue;
      references.push({ path: target, anchor, line: index + 1 });
    }
  });
  return references;
}

export function checkGuidance(input: GuidanceInput): Problem[] {
  const problems: Problem[] = [];
  const files = new Set(input.paths);
  const directories = new Set<string>();
  for (const path of input.paths) {
    for (let dir = posix.dirname(path); dir !== "."; dir = posix.dirname(dir)) directories.add(dir);
  }
  const exists = (path: string) => files.has(path) || directories.has(path.replace(/\/$/, ""));
  const isFuture = (path: string) =>
    Object.keys(input.futurePaths).some(
      (future) => path === future || path === future.replace(/\/$/, "") || path.startsWith(future),
    );
  const guidance = input.paths.filter(isGuidance);

  // Future paths must be removed from the list once they exist.
  for (const [path, phase] of Object.entries(input.futurePaths)) {
    if (exists(path)) {
      problems.push({
        rule: "future-path",
        file: "scripts/data/future-paths.json",
        message: `'${path}' (${phase}) now exists; remove its entry`,
      });
    }
  }

  // Backticked paths and anchors resolve.
  for (const file of guidance) {
    const text = input.texts.get(file) ?? "";
    for (const reference of pathReferences(text)) {
      const candidates = [
        posix.normalize(posix.join(posix.dirname(file), reference.path)),
        posix.normalize(reference.path),
      ];
      const found = candidates.find((candidate) => exists(candidate));
      if (found === undefined) {
        if (!candidates.some(isFuture)) {
          problems.push({
            rule: "path",
            file,
            line: reference.line,
            message: `'${reference.path}' does not exist`,
          });
        }
        continue;
      }
      if (reference.anchor === undefined) continue;
      const target = input.texts.get(found.replace(/\/$/, ""));
      if (target === undefined || !anchors(target).has(reference.anchor)) {
        problems.push({
          rule: "anchor",
          file,
          line: reference.line,
          message: `'${reference.path}#${reference.anchor}' has no such heading`,
        });
      }
    }
  }

  // The CLAUDE.md budget.
  const claude = input.texts.get(CLAUDE_MD);
  if (claude === undefined) {
    problems.push({ rule: "budget", file: CLAUDE_MD, message: "is missing" });
  } else {
    const lines = claude.replace(/\n$/, "").split("\n").length;
    const bytes = Buffer.byteLength(claude, "utf8");
    if (lines > MAX_LINES || bytes > MAX_BYTES) {
      problems.push({
        rule: "budget",
        file: CLAUDE_MD,
        message: `${lines} lines and ${bytes} bytes; the budget is ${MAX_LINES} lines and ${MAX_BYTES} bytes`,
      });
    }
  }

  // Exactly one routing row per skill file.
  const skill = `${SKILL_DIR}SKILL.md`;
  const rows = (input.texts.get(skill) ?? "").split("\n").filter((line) => line.startsWith("|"));
  for (const file of input.paths) {
    if (!file.startsWith(SKILL_DIR) || file === skill) continue;
    const relative = file.slice(SKILL_DIR.length);
    const count = rows.filter((row) => row.includes(`\`${relative}\``)).length;
    if (count !== 1) {
      problems.push({
        rule: "routing",
        file: skill,
        message: `'${relative}' has ${count} routing rows; it needs exactly one`,
      });
    }
  }

  // A rule heading (R<n>) has one home.
  const homes = new Map<string, string[]>();
  for (const [file, text] of input.texts) {
    for (const line of stripFences(text)) {
      const heading = /^#{1,6}\s+(R\d+)\b/.exec(line);
      if (heading?.[1] !== undefined) {
        homes.set(heading[1], [...(homes.get(heading[1]) ?? []), file]);
      }
    }
  }
  for (const [rule, where] of homes) {
    if (where.length > 1) {
      problems.push({
        rule: "one-home",
        file: where[1] ?? "",
        message: `heading ${rule} appears ${where.length} times (${where.join(", ")}); it has one home`,
      });
    }
  }

  // Path rules and command skills are pointers.
  for (const file of guidance) {
    const pointer =
      file.startsWith(".claude/rules/") ||
      (file.startsWith(".claude/skills/") && file.endsWith("/SKILL.md") && file !== skill);
    if (!pointer) continue;
    const lines = body(input.texts.get(file) ?? "").length;
    if (lines > POINTER_MAX_LINES) {
      problems.push({
        rule: "pointer-only",
        file,
        message: `${lines} body lines; a pointer file has at most ${POINTER_MAX_LINES}`,
      });
    }
  }

  // Every control in the threat model names a test that exists.
  const threatModel = input.texts.get(THREAT_MODEL);
  if (threatModel === undefined) {
    if (!isFuture(THREAT_MODEL)) {
      problems.push({ rule: "threat-model", file: THREAT_MODEL, message: "is missing" });
    }
  } else {
    let inControls = false;
    let controls = 0;
    threatModel.split("\n").forEach((line, index) => {
      if (/^#{1,6}\s/.test(line)) inControls = /^#{1,6}\s+Controls\s*$/.test(line);
      if (!inControls || !/^\|\s*C\d+\s*\|/.test(line)) return;
      controls += 1;
      const tests = [...line.matchAll(/`(tests\/[^`]+)`/g)].map((match) => match[1] ?? "");
      const missing = tests.filter((test) => !files.has(test));
      if (tests.length === 0 || missing.length > 0) {
        problems.push({
          rule: "threat-model",
          file: THREAT_MODEL,
          line: index + 1,
          message:
            tests.length === 0
              ? "control names no test"
              : `control names a test that does not exist: ${missing.join(", ")}`,
        });
      }
    });
    if (controls === 0) {
      problems.push({
        rule: "threat-model",
        file: THREAT_MODEL,
        message: "has no control rows (C<n>)",
      });
    }
  }

  // Code-owner entries exist for the protected paths.
  const owners = input.texts.get(CODEOWNERS);
  if (owners === undefined) {
    if (!isFuture(CODEOWNERS)) {
      problems.push({ rule: "code-owners", file: CODEOWNERS, message: "is missing" });
    }
  } else {
    const patterns = owners
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"))
      .filter((line) => line.trim().split(/\s+/).length >= 2)
      .map((line) => line.trim().split(/\s+/)[0] ?? "");
    for (const path of input.protectedPaths) {
      if (!patterns.includes(`/${path}`)) {
        problems.push({
          rule: "code-owners",
          file: CODEOWNERS,
          message: `protected path '/${path}' has no owner entry`,
        });
      }
    }
  }

  return problems;
}
