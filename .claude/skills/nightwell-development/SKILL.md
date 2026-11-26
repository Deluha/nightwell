---
name: nightwell-development
description: How to work on Nightwell. Use for any change to this repository - code, rules, fixture, checkers, guidance, CI or docs. Routes each task to the one file that holds its detail.
---

# Nightwell development

`CLAUDE.md` is the contract; this skill is the detail. Open only the file the task needs. Each file is
the single home of what it covers: change a fact there and nowhere else.

## Routing

| Task                                                                                                         | File                                           |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Check a hard rule's full wording, the permanent docs, the simplicity audit, error handling                   | `references/conventions.md`                    |
| Write a comment, a terminal message or a CLI flag                                                            | `references/style.md`                          |
| Find where code belongs; the operating model, codenames and tech stack                                       | `references/architecture.md`                   |
| Use a domain term correctly; find the domain file for a concept                                              | `references/domain.md`                         |
| Findings, severities, confidence, tie kinds                                                                  | `references/domain/findings.md`                |
| The rule-file format and the matcher kinds                                                                   | `references/domain/rule-files.md`              |
| Run the gates, reach the fixture or the hosted database, handle an outside contribution, change a dependency | `references/qa-and-ci.md`                      |
| Understand or change what a checker parses                                                                   | `references/checkers.md`                       |
| Search before coding, brief a subagent, record a decision, apply the lessons loop                            | `references/recipes.md`                        |
| Change guidance: `CLAUDE.md`, this skill, agents, rules, hooks, settings, CI                                 | `references/workflows/changing-guidance.md`    |
| Change the fixture: a planted feature, a control, a canary, a pin                                            | `references/workflows/changing-the-fixture.md` |
| Test routing and ask-first behaviour before a guidance change merges                                         | `evals/evals.json`                             |

Workflow files for later tasks (adding a rule, adding a collector query, adding a
shim, adding an output form, updating for a Supabase release, releasing) arrive with the phase that
introduces the task; each gets its own row here.
