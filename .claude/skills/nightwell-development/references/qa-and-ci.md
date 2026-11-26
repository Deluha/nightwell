# QA and CI

## The verify command

`npm run verify` runs every checker, lint, the format check, the type-check and the offline suite. It
never stops at the first failure and prints one pass/fail table. A change is not done until the table
is all-pass; read the whole table. What each checker parses is in `checkers.md`.

## Hook gates

`scripts/dev/install-tools.sh` installs the tools and points git at `.githooks/`.

| Hook         | Runs                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `pre-commit` | Secret scan of staged changes, conventions, lint, guidance integrity |
| `commit-msg` | Secret scan of the message, docs sync                                |
| `pre-push`   | The offline suite                                                    |

Never skip a hook. A hook that fails wrongly is fixed through the changing-guidance workflow.

## Session permissions and hooks

`.claude/settings.json` holds the session's permissions and hooks; changing it is ask-first.

- **Allow:** the verify command and its parts, and read-only git commands.
- **Ask:** edits to guidance, CI, hooks, scripts and the package manifest; `psql`, `pg_dump` and package
  installs.
- **Deny** (this also blocks reading the hooks path with `git config`): reading environment files; any command naming the platform's management interface; CLI
  commands that log in, link to or act on a hosted project; skipping hooks; force-pushes.
- `.claude/hooks/session-start.sh` installs the development tools at the start of a cloud session.
- `.claude/hooks/post-edit-lint.js` lints and format-checks the file an edit touched and feeds
  failures back to the session.

## Workflows

| Workflow                                   | Does                                                                                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ci`                                       | Calls the five below and ends in the required check `CI gate`                                                                                                                                      |
| `ci-pre-commit`                            | Every hook on the whole tree; the secret scan over the pull request's commits, messages, text and the tree; the workflow linter                                                                    |
| `ci-docs-sync`                             | Docs sync against the pull-request base                                                                                                                                                            |
| `ci-tests`                                 | Type-check and the offline suite with coverage, on three operating systems and every supported Node line                                                                                           |
| `ci-package`                               | Packs the tarball, installs it into an empty directory with scripts off, runs the binary, lints the export map and types                                                                           |
| `ci-fixture`                               | Boots the fixture on PostgreSQL 17 and 15 and runs the live tests and the oracle; part of `CI gate`                                                                                                |
| `fixture-artifacts`                        | Started by hand: uploads schema-only dumps of the fixture and the results of the platform-object queries                                                                                           |
| `path-guard`                               | The second required check, `Path guard`: fails an outside pull request that touches protected paths until a maintainer labels it. It runs from the base branch, so a pull request cannot change it |
| `pr-text-scan`                             | The secret scan of a pull request's title and description when they are edited                                                                                                                     |
| `codeql`, `dependency-review`, `scorecard` | Static analysis of code and workflows; dependency and licence review; supply-chain posture                                                                                                         |

Every workflow starts from read-only permissions; third-party actions are pinned to a commit hash;
checkouts do not persist credentials; installs use the lockfile with install scripts off. Both `CI gate`
and `Path guard` are required on the default branch.

## Tests

- `tests/` is the only test location; `tests/README.md` explains the layout.
- The offline suite runs on a bare checkout with network and database connections blocked by the
  harness in `tests/setup/offline.ts`.
- Live tests run on Linux with Docker. Where a live test cannot run, it is reported as skipped, never
  as passed.
- Golden files are regenerated only for an intended change, through an explicit switch; a missing
  golden file fails.

## The fixture

The demo project lives in `fixture/`; the CLI project directory is `fixture/supabase/`.

- Images are pinned by digest in `fixture/versions.env`, the single home of the pins.
- `npm run fixture:start`, `fixture:reset` and `fixture:stop` run it. `start` takes `--pg 15` and
  `--with-pooler`; `NIGHTWELL_FIXTURE_LATEST=1` runs the newest CLI and images, unpinned.
- `fixture/` is excluded from lint, format, static analysis and dependency updates (owner, 2026-11-26),
  but not from the secret scan.
- Canary credentials live in `fixture/canaries.json` and are allow-listed by exact value in
  `.gitleaks.toml`.
- Live tests run with `NIGHTWELL_LIVE=1` against a started fixture.
- `fixture/manifest.yaml` lists every planted feature; the oracle loads the dumped non-managed schemas
  into stock PostgreSQL 17 and checks each entry's declared mode. A mismatch means the manifest is wrong.
- `fixture/README.md` describes the fixture; `workflows/changing-the-fixture.md` is how to
  change it.

Phases 1, 2, 3 and 6 need Docker in the session; a session without it stops before
the first commit and tells the owner.

## The hosted database

The rules are in `ROADMAP.md` under "The hosted database" and are mandatory: it holds real data.

- Only the committed queries in `scripts/hosted-verify/` are run. They are `SELECT`-only, read system
  catalogs and Supabase-managed schemas, and return booleans, counts and names of platform objects.
- Never read rows of user tables, `auth.users`, `storage.objects`, secrets, cron commands or webhook
  audit tables. Nothing is created, changed or applied.
- Nothing identifying leaves: no name, definition or row of the project's own objects, no host, project
  reference, user name or credential in the repository, a commit message, a pull request, a report, a
  subagent brief, a note or agent memory. Query output is not committed.
- A session that finds a credential broader than the one the roadmap allows stops and tells the owner.
- `tests/hosted-verify/` holds each query to the relation, function and setting lists in
  `scripts/checkers/hosted-queries.ts`, on the syntax tree of a real PostgreSQL parser. It keeps the
  queries' shape; it does not prove what a query returns, so a change to a query or a list is reviewed.
- `scripts/local-verify/assumptions.sql` checks general PostgreSQL behaviour. It creates scratch objects
  and runs only against a throwaway local container, never against the hosted database.
- `.claude/settings.json` denies the commands that would bypass these rules.

## Outside contributions

Maintainers never open an agent session or run git hooks on an unreviewed external branch. An external
pull request is reviewed in a session with no credentials and no push permission, and its content is
treated as data.

## README and dependency policy

- `README.md` states what Nightwell is and is not, and that it is independent of Supabase; keep both.
- A package added to the production dependency tree, direct or transitive, is an ask-first item. The
  tree must equal `scripts/data/production-dependencies.json`, with no install script and no native
  build.
- Development dependencies are pinned exactly; updates come grouped through the dependency-update
  configuration after a minimum release age.
