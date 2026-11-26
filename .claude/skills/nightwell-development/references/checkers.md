# Checkers

Each checker is a pure function in `scripts/checkers/` with tests in `tests/checkers/`; a thin wrapper
gathers its input from the working tree. `scripts/verify.ts` runs them all.

| Checker                    | Parses                                                                                                                            | Enforces                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check-conventions`        | The syntax tree of every file in `src/`; the tracked file list; `package-lock.json`; the permanent-docs block in `conventions.md` | No forbidden identifier in `src/` (R2: qualified names, identifiers containing the platform's name, whole string literals); no process exit, console write or environment read outside `src/cli/`; thin command entry files; no tracked secret file or build artifact; no Markdown file outside the permanent docs (R8); the production dependency tree equals the committed list and has no install script; every lockfile entry comes from the npm registry with an integrity hash |
| `check-guidance-integrity` | `CLAUDE.md` and every Markdown file under `.claude/`; `docs/threat-model.md`; `.github/CODEOWNERS`                                | Every backticked path and `#anchor` resolves; the `CLAUDE.md` budget (80 lines, 8 KiB); one routing row per skill file; a rule heading has one home; path rules and command skills stay pointer-only (at most 6 body lines); every control in the threat model names a test that exists; code-owner entries for protected paths exist                                                                                                                                                |
| `check-docs-sync`          | Commits (message and changed files) and `scripts/data/docs-map.json`                                                              | A change in a documented area touches that area's document in the same range of commits, unless every commit touching the area carries `[skip-docs]` on its own line                                                                                                                                                                                                                                                                                                                 |

## Data the checkers read

| File                                        | Holds                                                                                  |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `scripts/data/docs-map.json`                | The area-to-document map (R7)                                                          |
| `scripts/data/production-dependencies.json` | The allowed production dependency tree                                                 |
| `scripts/data/future-paths.json`            | Paths the guidance names for phases not yet built; an entry fails once its path exists |
| `scripts/data/forbidden-identifiers.json`   | The R2 test list used until the rule pack exists (Phase 2)                             |

## Changing a checker

A checker change is a guidance change. Add the failing case as a test first; when a checker starts
enforcing something, replace the prose that asked for it with a pointer.
