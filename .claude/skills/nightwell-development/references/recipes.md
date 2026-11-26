# Recipes

## Grep before coding

```sh
git grep -n "<term>" -- src scripts            # is there already a home for this?
git grep -n "nightwell: " -- src/cli           # existing terminal messages
git grep -n -- "--<flag>" -- src/cli           # existing flags
git grep -n "<fact>" -- CLAUDE.md .claude docs # the fact's single home
```

## Orchestration

1. Decide the design and the acceptance criteria yourself; a subagent never designs.
2. Brief with the format below; one brief per commit.
3. Read the returned diff and run `npm run verify` yourself before accepting it.
4. Send the diff to `reviewer` with the acceptance criteria, not with your opinion of the diff.

## The subagent brief

```text
Goal:        one sentence
Files:       the exact paths to read and to change
Change:      the exact change, with signatures or sample output where they matter
Constraints: hard rules that apply; what must not change
Acceptance:  commands to run and what their output must show
```

A brief never contains a credential, a connection string or anything read from the hosted database.

## Implementation Decision format

Used in a reply or a pull request whenever a non-trivial approach is chosen:

```text
Decision:   what was chosen
Confidence: high | medium | low
For:        the reasons
Against:    the costs and risks
Better:     the better approach, if one exists and was not taken, and why not
```

## Lessons loop

A review finding or a repeated mistake is fixed twice: in the code, and in the cheapest guard that
stops it recurring. Try in this order:

1. A checker rule or a test.
2. A hook or a permission.
3. One line in the rule's single home.
4. Nothing, with the reason stated in the pull request.

When a checker starts enforcing something, replace the prose that asked for it with a pointer.
