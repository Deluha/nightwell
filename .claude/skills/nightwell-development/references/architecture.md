# Architecture

## Module map

One direction of dependency: `cli` → everything; `model` ← everything; nothing imports `cli`.

| Path            | Holds                                                                                                                     | Arrives                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `src/cli/`      | Argument parsing, input and output, exit codes. The only place that exits, writes to the console or reads the environment | Phase 0                  |
| `src/index.ts`  | The public API                                                                                                            | Phase 0 (empty), Phase 2 |
| `src/model/`    | Finding, enumerations, typed errors; the source of the JSON Schemas                                                       | Phase 2                  |
| `src/collect/`  | Connection, the fixed statement set, the redacted catalog snapshot                                                        | Phase 2                  |
| `src/engine/`   | Rule-pack loader, matcher kinds, fact extraction                                                                          | Phase 2                  |
| `src/report/`   | One renderer per output form                                                                                              | Phase 2                  |
| `src/codescan/` | Static analysis of JavaScript and TypeScript                                                                              | Phase 4                  |
| `src/score/`    | Dependency score per feature area                                                                                         | Phase 5                  |
| `src/shims/`    | Selection and emission of shim SQL                                                                                        | Phase 6                  |
| `src/plan/`     | The migration planner                                                                                                     | Phase 7                  |
| `packs/`        | The built-in rule pack                                                                                                    | Phase 2                  |
| `queries/`      | Catalog queries, the allow-lists and the deny-list                                                                        | Phase 2                  |
| `data/`         | Shim templates, score, plan steps, options, platform inventory                                                            | Phases 3–7               |
| `schema/`       | JSON Schemas shipped in the package                                                                                       | Phase 2                  |
| `fixture/`      | The demo Supabase project                                                                                                 | Phase 1                  |
| `scripts/`      | Checkers, the verify command, development tools, hosted verification queries                                              | Phase 0                  |
| `tests/`        | Every test; `tests/snapshots/` holds generated snapshots                                                                  | Phase 0                  |
| `docs/`         | The threat model and the stability policy                                                                                 | Phase 0                  |

## Operating model

| Agent         | Tier                       | Role                                           |
| ------------- | -------------------------- | ---------------------------------------------- |
| Session model | —                          | Owns gates, design, briefs and the done gate   |
| `implementer` | Mid-tier, medium effort    | Implements exactly the brief                   |
| `reader`      | Small, medium effort       | Read-only sweeps; conclusions with `file:line` |
| `reviewer`    | Session model, high effort | Reviews a diff it did not write; never edits   |
| `scribe`      | Small, medium effort       | Notes and drafts outside the repository tree   |

Model tiers are named in this table and in each agent's frontmatter under `.claude/agents/`, and
nowhere else; a call never sets a model.

## Codenames

Features carry codenames, listed in `ROADMAP.md`. They are used in contributor docs and conversation
only: never in module, file, command or JSON field names, CLI output, report content or the package
description.

## Tech stack

- TypeScript on Node.js 22, 24 and 26, ES modules only, distributed through npm.
- Development runs TypeScript directly through Node's type stripping (Node 22.18 or newer); the
  published package holds compiled JavaScript and type declarations.
- One JavaScript/TypeScript parser, `@babel/parser`: used by the checkers now, and by the code scan and
  the JSONC reader later.
- Runtime dependencies are added by the phase that first uses them and are bundled into the tarball;
  the committed list is `scripts/data/production-dependencies.json`.
- Argument parsing and colour come from Node built-ins. The test runner is Vitest.
