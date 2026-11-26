# Workflow: changing guidance

For any change to `CLAUDE.md`, this skill, the agents, the path rules, the command skills, hooks,
`.claude/settings.json`, checkers or CI workflows.

## Preconditions

- ⚑ Ask first: the owner has confirmed the change. Guidance and CI are ask-first items.
- The change has one home. Find it with the routing table; do not add a second copy.

## Steps

1. State the problem the change solves and the cheapest guard that solves it (see the lessons loop in
   `../recipes.md`).
2. Make the change in the single home. If a checker can enforce it, change the checker and replace the
   prose with a pointer.
3. Keep `CLAUDE.md` inside its budget; move detail into the skill.
4. Add or update a routing row when a skill file is added, renamed or removed.
5. Add or update a prompt in `../../evals/evals.json` when routing or ask-first behaviour changes.

## Verification

- `npm run verify` passes; `check-guidance-integrity` is the relevant row.
- Run the prompts in `../../evals/evals.json` by hand in a fresh plan-mode session; each must reach
  the expected file or stop at the expected gate.

## Docs to update

- `../qa-and-ci.md` for a hook, gate or workflow; `../checkers.md` for a checker.
- The pull-request template's "Ask-first items touched" section names the change.
