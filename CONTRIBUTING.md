# Contributing

Thank you for considering a contribution. You need no particular editor or assistant: everything a
contribution must pass runs from the command line.

## Setup

You need Node.js 22.18 or newer and git. Go is needed only for the secret scanner and the workflow
linter, which CI runs for you if you do not have it.

```sh
bash scripts/dev/install-tools.sh   # locked npm packages, pinned tools, git hooks
npm run verify                      # every gate; prints one pass/fail table
```

`npm run verify` is the bar: a pull request is ready when every row passes.

## What to contribute

- **A factual error in a rule** is a bug. Open a "Factual correction" issue with the public source that
  shows the rule is wrong.
- **A false positive or a missed tie**: open the matching issue with the smallest SQL or code that shows
  it. Never attach a snapshot or a report from a real project.
- **A new rule** (from Phase 2 on): a rule is data, cites a public source from the accepted hosts with
  the date you read it, and comes with a fixture entry that makes it fire and a near-miss that does not.
  Rule severities are decided by the maintainers.
- **Code**: open an issue first for anything larger than a fix, so the design is agreed before you write
  it.

## Rules a contribution must keep

- Tests live only in `tests/`. A behaviour change comes with a test.
- No new Markdown files; documentation lives in the existing documents.
- A change in a documented area updates its document in the same pull request.
- No new production dependency without the maintainers' agreement.
- Nothing from another codebase: no copied product code, fixtures or data. All test data is synthetic.
- Rule and report text states facts. A tie is a dependency, not a defect.

## Commits

- Write the subject in the imperative, at most 72 characters, without a trailing full stop; explain the
  why in the body.
- Sign off every commit (`git commit -s`). The sign-off certifies the
  [Developer Certificate of Origin](https://developercertificate.org/): that you wrote the change or have
  the right to submit it under the project's licence. There is no contributor licence agreement.
- Never skip a hook. If a hook fails wrongly, say so in the pull request.

## Pull requests

Fill in the template. A pull request from outside the maintainers that touches the guidance, CI,
scripts or scanner configuration waits for a maintainer to read the diff before its checks can pass.

## Conduct and security

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Report vulnerabilities
privately, as [SECURITY.md](SECURITY.md) describes, never in a public issue.
