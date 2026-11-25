# Nightwell — Roadmap

The planned scope of the next release. `RELEASE_NOTES.md` (created in Phase 0) records what shipped; this
file records what is planned. A release's section leaves this file when the release is tagged. Owner
decisions are dated; items marked *proposed* are defaults the owner has not yet confirmed.

## v0.1 — First public release

Goal: a command-line tool that audits a Supabase project, reports everything that ties it to the Supabase
platform, and gives a plan for moving to plain PostgreSQL.
Constraint: every detection rule is written from public sources and proven against the demo project in
this repository.

### What v0.1 does

- **Scans the database** over a read-only connection: row-level security policies that call Supabase auth
  helpers, grants and policies that use Supabase's built-in roles, foreign keys and triggers pointing into
  Supabase-managed schemas, realtime publications, Supabase-specific extensions, database webhooks, and
  functions exposed through the auto-generated REST API.
- **Scans the application code** by static analysis: uses of the Supabase client SDK (data queries, auth,
  storage, realtime, RPC), edge functions, and environment variables that assume the Supabase gateway.
- **Produces** a lock-in report (each finding has a location, a category and a severity: portable, needs a
  replacement, needs a redesign) as a terminal summary, JSON and HTML; a dependency score per feature area
  (database, auth, storage, realtime, edge functions, REST layer); a migration plan that orders the
  findings by dependency; and optional compatibility shims as SQL (an `auth.uid()` replacement, stand-in
  roles) so existing policies keep working on plain PostgreSQL during a gradual migration.

### Scope rules (owner decisions, 2026-11-25)

- **Read-only.** Nightwell never writes to the scanned project and never migrates data. It emits files
  (reports, plans, shim SQL); the user applies them.
- **Destination-neutral.** No assumption about where the user migrates to. No destination product is
  recommended, ranked or defaulted.
- **No replacements shipped.** Nightwell does not ship replacements for auth, storage or realtime; it lists
  the options. Shims are limited to SQL that keeps existing policies and grants valid.
- **Detection rules are data, not code.** They live in versioned rule files, because Supabase changes its
  internals between releases.
- **Public sources only.** Rules come from Supabase's documentation and open source repositories, looked up
  at the time the rule is written and cited in the rule. Nothing is written from memory.
- **One demo project, all tests.** The repository contains its own demo Supabase project as a test fixture,
  which uses every feature Nightwell detects. All tests run against it.
- **Standalone.** No product code, fixtures or data from any other codebase.
- **Licence.** MIT.
- **Naming.** Features carry codenames from Suramar and the Nighthold; Gul'dan is the lead feature (table
  below).
- **Delivery.** One pull request per phase, several commits each. Nothing is built before Phase 0.
- **Phase order.** Phase 1 is the demo fixture, Phase 2 the database scan with terminal and JSON output.
  The rest is ordered below (*proposed*), as is Phase 0, which precedes them.
- **Sign-off.** Each phase lists what the owner confirms before its code is written.

### Proposed additions and amendments (owner to confirm at the Phase 0 sign-off)

| # | Proposal | Why |
|---|---|---|
| A1 | **Phase 0 — Foundations** before the fixture: the development process, guidance, checkers and CI, and an empty CLI | Phase 1 needs a toolchain, a test runner and the working rules to be built under |
| A2 | **Catalog snapshot** (Telemancy): the database scan is split into a collector that writes a catalog snapshot file and an analyzer that reads it; `nightwell snapshot` exports one and `nightwell audit --snapshot` analyses it without a connection | Offline unit tests; users can inspect exactly what was read; audits where the tool may not reach the database; reproducible bug reports |
| A3 | **Portability proof** (Arcan'dor): a test that loads the demo schema plus the shims into a stock PostgreSQL and runs the same policy assertions as on the Supabase fixture | Turns "policies keep working on plain PostgreSQL" from a claim into a tested fact |
| A4 | **Lock-in gate** (Tichondrius): `nightwell check` compares an audit with a committed baseline and fails on new findings | During a gradual migration, stops new ties being added while old ones are removed |
| A5 | **Drift watch**: a scheduled CI job boots the fixture on the newest Supabase CLI and database image and reports rule or snapshot differences in an issue | Supabase changes internals between releases; this is the alarm |
| A6 | **Project configuration scan**: the code scan also reads the Supabase project config file (`config.toml`, `config.json`, `config.jsonc`) | Edge-function settings, exposed schemas and auth hooks are declared there |
| A7 | **Plan as Markdown checklist** next to terminal, JSON and HTML | Pastes into an issue tracker |
| A8 | **Confidence on code findings** (certain / probable) | Static analysis cannot always prove a call belongs to the Supabase client; the report says so instead of guessing |
| A9 | **JavaScript and TypeScript only** for the code scan in v0.1 | Other SDK languages follow after the release (see Not in v0.1) |

### Codenames

Each feature is named after a Nighthold encounter; supporting pieces take names from Suramar. Codenames
are used in docs, banners and conversation; they never replace module, file or command names.

| Codename | Feature | Phase |
|---|---|---|
| **Gul'dan** | Lead feature: the lock-in audit — the `nightwell audit` command and the lock-in report it produces (findings with location, category, severity) | 2, completed through 7 |
| **Skorpyron** | The demo Supabase project (test fixture), the first encounter everything else stands behind | 1 |
| **Trilliax** | The database scan: the read-only collector that sweeps the catalog | 2 |
| **Chronomatic Anomaly** | The versioned rule packs and the rule engine | 2 |
| **Spellblade Aluriel** | The report renderers, one per form: terminal, JSON, HTML | 2 and 7 |
| **High Botanist Tel'arn** | The application code scan (syntax trees) | 3 |
| **Krosus** | The dependency score per feature area | 4 |
| **Grand Magistrix Elisande** | The compatibility shims: echoes of the platform that keep old policies working | 5 |
| **Star Augur Etraeus** | The migration plan and the options catalogue | 6 |
| **Tichondrius** | The lock-in gate (`nightwell check`) | 8 |
| **Arcan'dor** | The portability proof on stock PostgreSQL | 5 |
| **Telemancy** | The catalog snapshot | 2 |

### Evidence base (public sources, read 2026-11-25)

Planning inputs only: they decided the scope and the fixture's contents. They are not rules. Every rule
written in Phases 2 and 3 re-reads its own source and cites it. Sources are the open source repositories
under `github.com/supabase` (the documentation was read from its source in `supabase/supabase` under
`apps/docs/content/`, because `supabase.com` was not reachable from the development environment).

| Area | Finding | Source |
|---|---|---|
| Auth helpers | `auth.uid()`, `auth.role()`, `auth.email()`, `auth.jwt()` read the `request.jwt.claim.*` / `request.jwt.claims` settings. The current definitions are installed by the Auth service's migrations, not by the database image | `supabase/auth` `migrations/20220224000811_update_auth_functions.up.sql`, `20220531120530_add_auth_jwt_function.up.sql` |
| Roles | `anon`, `authenticated`, `service_role`, `authenticator`, `supabase_admin`, the `supabase_*_admin` service roles, `dashboard_user`, `pgbouncer` and others; the reserved list is in the supautils configuration | `supabase/postgres` `migrations/db/init-scripts/`, `ansible/files/postgresql_config/supautils.conf.j2` |
| Scanner role | No read-only role is documented for customers; `supabase_read_only_user` is internal | `supabase/supabase` docs `guides/database/postgres/roles.mdx` |
| Managed schemas | The CLI keeps an internal-schema list (`auth`, `storage`, `realtime`, `vault`, `extensions`, `graphql`, `graphql_public`, `supabase_functions`, `supabase_migrations`, `cron`, `net`, `pgmq`, `pgsodium`, …) | `supabase/cli` `apps/cli/src/commands/inspect/db/inspect-schemas.ts` |
| Realtime | Publication `supabase_realtime`; database-side broadcast through `realtime.send` / `realtime.broadcast_changes`; authorization through policies on `realtime.messages` using `realtime.topic()` | `supabase/postgres` `migrations/schema-17.sql`; `supabase/realtime` `priv/repo/tenant_schema/realtime/functions/` |
| Webhooks | Triggers executing `supabase_functions.http_request(...)`, built on `pg_net` | docs `guides/database/webhooks.mdx`; `supabase/supabase` `docker/volumes/db/webhooks.sql` |
| Extensions | Supabase-maintained: `pg_graphql`, `pg_net`, `supabase_vault`, `pg_jsonschema`, `wrappers`, `index_advisor`, `supautils`; deprecated on PostgreSQL 17: `pgjwt`, `plv8`, `plls`, `plcoffee`, `timescaledb`; `pgsodium` pending deprecation | `supabase/postgres` `nix/ext/versions.json`; docs `guides/platform/upgrading.mdx` |
| REST layer | Exposed schemas default to `public`, `graphql_public`; functions there are RPC endpoints; default privileges in `public` grant to `anon` / `authenticated` / `service_role`, and that default is being withdrawn for new projects — so the scan reads actual grants and `pg_default_acl`, never assumes | docs `guides/api/securing-your-api.mdx`; `supabase/cli` `packages/config/src/api.ts` |
| Client SDK | `supabase-js` v2 (v3 in prerelease): `from`, `schema`, `rpc`, `channel`, `auth.*`, `storage.*`, `functions.invoke`; server packages `@supabase/ssr`, `@supabase/server`; `@supabase/auth-helpers-*` superseded | `supabase/supabase-js` `packages/core/*/src/` |
| Edge functions | `supabase/functions/<name>/index.ts`; injected `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_JWKS`, legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | docs `guides/functions/secrets.mdx` |
| Gateway | Paths `/rest/v1`, `/auth/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1`, `/graphql/v1`; hosts `<ref>.supabase.co`, pooler hosts; key formats `sb_publishable_…` / `sb_secret_…` beside the legacy JWT keys | `supabase/supabase` `docker/volumes/api/kong.yml`; docs `guides/getting-started/api-keys.mdx` |
| Other ties | Vault secrets (not decryptable after a plain dump and restore), `pg_cron` jobs calling `net.http_post` to edge functions, auth hooks as PostgreSQL functions granted to `supabase_auth_admin`, queues (`pgmq`), foreign data wrappers | docs `guides/database/vault.mdx`, `guides/functions/schedule-functions.mdx`, `guides/auth/auth-hooks.mdx`, `guides/queues/api.mdx` |
| Fixture runtime | `supabase db start` (CLI v3, pinned) starts only the database yet runs the auth, storage and realtime schema migrations and installs the webhook objects. A bare database image lacks them | `supabase/cli` `apps/cli/src/command-internal/db-bootstrap/db-setup.ts`; docs `guides/deployment/managing-environments.mdx` |
| Project config | Since CLI 3.4.0 `supabase init` writes `supabase/config.jsonc`; `config.toml` and `config.json` are still read | docs `guides/local-development/cli/config-formats.mdx` |

Consequences: "everything in `public` is exposed" depends on the project's age, so exposure is always
measured; the auth helpers exist only where the Auth migrations ran, so the fixture must be the CLI's
database and not the bare image; PostgreSQL 17 is the fixture's version, and extensions that exist only on
15 (`pgjwt`) are covered by snapshot-level tests, not by the live fixture.

### Status

| Phase | Status | Pull request |
|---|---|---|
| 0 — Foundations | Not started | |
| 1 — Skorpyron: the demo fixture | Not started | |
| 2 — Trilliax: database scan, terminal and JSON | Not started | |
| 3 — Tel'arn: application code scan | Not started | |
| 4 — Krosus: dependency score | Not started | |
| 5 — Elisande: compatibility shims and the portability proof | Not started | |
| 6 — Etraeus: migration plan and options | Not started | |
| 7 — Aluriel: HTML report | Not started | |
| 8 — Tichondrius: lock-in gate and release | Not started | |

### Running a phase

One development session per phase, in order. A phase starts only when the previous phase's pull request
is merged. Kick-off prompt: "Implement Phase N of `ROADMAP.md` following its Running a phase section."

1. **Read.** This file, then (from Phase 1 on) `CLAUDE.md` and the development skill; route each commit
   through the skill's workflow file.
2. **Sign-off first.** Present the phase's sign-off items to the owner as concrete proposals (file layouts,
   sample output, rule tables, signatures, thresholds) and wait for confirmation before writing code.
   Record each confirmed decision under the phase, dated, in the phase's first commit.
3. **Implement.** One commit per table row, in order, each passing the verify command.
4. **Review.** The `reviewer` agent reviews the whole phase diff before the pull request opens; its
   findings are fixed in further commits and reviewed again.
5. **Deliver.** One pull request for the phase; the phase's Status row names it ("In review"). The next
   phase's first commit sets the previous row to "Merged". Each phase adds its entry to one
   "v0.1.0 — in development" section at the top of `RELEASE_NOTES.md`; Phase 8 turns it into the release
   entry and removes the v0.1 section from this file.
6. **Stay in scope.** The scope rules bind every phase. A phase that finds an agreed item infeasible, or
   needs something not listed here, stops and asks the owner; it never narrows or widens scope itself.
7. **Public sources.** Anything about Supabase's behaviour is read at the time of use from Supabase's
   documentation or open source repositories and cited (URL, file path, date read). When the rendered
   documentation is unreachable, its source in the `supabase/supabase` repository is read instead. A fact
   that cannot be verified is reported as unverified, never filled in from memory.
8. **The fixture.** The demo database runs only where Docker is available. Where it is not, the live tests
   are reported as skipped (never as passed) and the pull request's CI run is the evidence.

### Phase 0 — Foundations

The way of working, set up before any product code. Self-contained: this section is the specification.

| Commit | Content |
|---|---|
| 1 | Toolchain and an empty CLI: package manifest, compiler and linter configuration, test runner, the `nightwell` binary printing its version and help, `.editorconfig`, `.gitignore`, a development-container definition. |
| 2 | `CLAUDE.md`: the always-loaded contract — operating principles, the workflow for any change, the hard rules in short form with pointers, the ask-first list. Budget: at most 80 lines and 8 KiB. |
| 3 | The development skill `.claude/skills/nightwell-development/`: `SKILL.md` as a routing table naming the one file that holds each task's detail, and its `references/` (below). |
| 4 | Agents in `.claude/agents/`: `implementer`, `reader`, `reviewer`, `scribe` (below). |
| 5 | Path rules in `.claude/rules/` and thin command skills (`/verify`, `/review-diff`, `/guidance-change`), each pointer-only. |
| 6 | Checkers and the verify command in `scripts/`, with their tests (below). |
| 7 | `.claude/settings.json` and `.claude/hooks/`: permissions, a session-start hook that installs the development tools in cloud sessions, a post-edit hook that lints the edited file and feeds failures back. |
| 8 | Git hooks and CI: hook configuration, the workflows `ci-pre-commit`, `ci-docs-sync`, `ci-tests`, dependency-update configuration, code owners, the secret-scan configuration. |
| 9 | Project documents: `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `RELEASE_NOTES.md` (with "v0.1.0 — in development"), `tests/README.md`, the pull-request template. |

**Operating principles** (for `CLAUDE.md`):

1. Flag uncertainties: ask, do not assume. Validate each request against the repository's patterns and flag
   a conflict instead of silently complying. Unattended, take the most reasonable reading and record the
   assumption in the reply. The ask-first list and the ⚑ marks in workflow files are mandatory gates.
2. The orchestrator designs and signs off; the writer implements; the reader reads; the reviewer reviews.
   The session model owns gates, design, briefs and the done gate (it reads the diff and runs the verify
   itself; a subagent's summary is never evidence of done). Repository edits go to `implementer`, except a
   small edit (one file, about 20 changed lines at most, no ask-first item, no new logic). Reads spanning
   more than three files go to `reader`; every non-trivial diff goes to `reviewer`, who is never its author.
3. Be concise: outcome first, tables and checklists over prose. Never drop the required signals: a
   confidence label on architectural calls, a flag for pattern conflicts, for and against on non-trivial
   approaches, and the better approach when one exists.
4. Modular, single source of truth: every fact, constant and definition has one home; surgical changes over
   sweeping refactors; every pull request leaves touched files clearer than it found them.

**Hard rules** (*proposed*; short form in `CLAUDE.md`, full form in `references/conventions.md`):

| # | Rule |
|---|---|
| R1 | **Read-only.** Every statement sent to a scanned database is a query file under `queries/`, a single `SELECT`, run in a read-only transaction. No code path writes; no rows of user tables are read. |
| R2 | **Detection is data.** No Supabase identifier (schema, role, function, extension, publication, SDK method, environment-variable name, URL path) appears in `src/`; they live in the rule packs. |
| R3 | **Public sources only.** Every rule cites at least one source on Supabase's documentation site or under `github.com/supabase`, with the date read. |
| R4 | **The fixture is the only test subject** and every rule fires on it. No code, fixture or data from another project. |
| R5 | **Neutral and bounded.** No destination is assumed or recommended; option lists are unranked; no replacement for auth, storage or realtime is shipped. |
| R6 | **One definition.** Severities, categories, feature areas and the finding shape are defined once and imported; the JSON output carries a schema version. |
| R7 | **Docs move with the code.** A change in a documented area updates that area's document in the same pull request (`[skip-docs]` on its own line in a commit message is the escape hatch, not the default). |
| R8 | **No files nobody asked for.** Tests live only in `tests/`; no planning, notes or progress documents beyond the permanent docs and this file. |
| R9 | **Secrets never leave.** Connection strings, keys and environment-variable values are never printed, logged or written into a report; names only. |

**Ask first** (*proposed*): the severity, category and area definitions and any rule's severity; the score
formula, weights and bands; the plan's step order and dependencies; the options catalogue; shim SQL
semantics; a breaking change to the JSON schema, the CLI's flags or its exit codes; the relations the
collector may read; the list of accepted public-source hosts; a new runtime dependency; and the guidance
machinery and CI (`CLAUDE.md`, `.claude/settings.json`, agents, hooks, workflows, hook and secret-scan
configuration), which `permissions.ask` also gates mechanically.

**Skill references** (each a single home; `SKILL.md` gets exactly one routing row per file):
`conventions.md` (hard rules in full, simplicity audit, error handling), `style.md` (comments, terminal
messages, CLI flags: one flag name per concept, one wording per situation), `architecture.md` (module map,
operating model, codenames, tech stack), `domain.md` and the domain files it indexes (findings and
severities; rule-file format; later score, plan, shims), `qa-and-ci.md` (hook gates, the verify command,
workflows, how a session reaches the fixture, README and dependency policy), `checkers.md` (what each
checker parses), `recipes.md` (grep-before-coding commands, orchestration and the subagent brief, the
Implementation Decision format, the lessons loop), `workflows/` (one step-by-step file per recurring task,
each with Preconditions, Steps, Verification, Docs to update and ⚑ Ask first: changing guidance; later
adding or changing a rule, changing the fixture, adding a collector query, adding a shim, adding an output
form, updating for a Supabase release, releasing), and `evals/evals.json` (routing and ask-first prompts
run by hand in a fresh plan-mode session before a guidance change merges).

**Agents** (model tiers named only in the agent frontmatter and one roles table; never a `model` on the call):

| Agent | Tier | Tools | Role |
|---|---|---|---|
| `implementer` | mid-tier model, medium effort (high on the call for bug fixes and edge-case-heavy work) | Read, Grep, Glob, Edit, Write, Bash | Implements exactly the brief (goal, files, exact change, constraints, acceptance criteria), runs the targeted checks and pastes their raw output; stops at ambiguity or an ask-first item |
| `reader` | small model, medium effort | Read, Grep, Glob | Read-only sweeps; conclusions with `file:line`, never dumps |
| `reviewer` | session model, high effort | Read, Grep, Glob, Bash | Reviews a diff it did not write against the acceptance criteria, the hard rules, the simplicity audit and the style conventions; reports verified findings, most severe first; never edits |
| `scribe` | small model, medium effort | Read, Write | Notes and drafts outside the repository tree, never committed |

**Checkers** (each a pure function with tests; the verify command runs all of them plus lint, type-check and
tests, never stops at the first failure and prints one pass/fail table):

- `check-conventions`: the mechanical code rules, starting with R2 (no Supabase identifier in `src/`), R9
  (no tracked secret or build artifact) and thin command entry files.
- `check-guidance-integrity`: every backticked path and `#anchor` in the guidance resolves; the `CLAUDE.md`
  budget; one routing row per reference file; a rule heading (`R<n>`) has one home; path rules and command
  skills stay pointer-only (at most 6 body lines).
- `check-docs-sync`: a code change in a documented area touches that area's document; run on each commit
  message locally and against the pull-request base in CI.

**Gates:** git hooks at commit (secret scan of staged changes, conventions, lint, guidance integrity), at
commit-message (docs sync) and at push (the fast tests). CI repeats every hook on the whole tree, scans the
pull request's commits and the tree for secrets with a pinned, checksum-verified scanner, runs tests with
coverage, the type-check and a workflow linter, and ends in one `CI gate` check to require. Third-party
actions are pinned to a commit hash; checkouts do not persist credentials.

**Lessons loop:** a review finding or repeated mistake is fixed twice: in the code and in the cheapest guard
that stops it recurring — a checker rule or test, then a hook or permission, then one line in the rule's
single home, or nothing with the reason stated in the pull request. When a checker starts enforcing
something, the prose that asked for it is replaced by a pointer.

**Tests:** `tests/` is the only test location. The offline suite runs on a bare checkout with network and
database connections blocked by the harness, not by convention. Golden files pin output; they are
regenerated only for an intended change through an explicit switch, the diff is the reviewable proof, and
a missing golden file fails.

**Pull-request template sections:** Summary; Changes; Docs updated; QA gates run; Review agents run; Not
tested live / to do by hand; Lessons; Rule-pack changes (sources cited, fixture coverage); Ask-first items
touched.

Sign-off: proposals A1–A9; the tech stack; the hard rules and the ask-first list as worded above; the
repository layout; agent tiers; whether the guidance checker skips paths this file names for phases not
yet built.

Tech stack (*proposed*, confidence medium-high):

| Approach | For | Against |
|---|---|---|
| **TypeScript on Node.js (current LTS)**, distributed through npm (`npx nightwell`) | The audience already has Node; the TypeScript compiler parses the code to be scanned with no extra parser; one language for tool and fixture app | Checkers and hooks are written in TypeScript too |
| Python | Mature SQL and CLI tooling | A second runtime for Supabase users; JavaScript parsing needs a bundled grammar |
| Go or Rust | Single static binary | Slowest to build; JavaScript analysis is weakest |

Selected: TypeScript, with `pg` for the connection, rule files in YAML validated by a JSON Schema, a
single lint-and-format tool, and a git-hook runner installed with the dev dependencies. Layout
(*proposed*): `src/` (`cli/`, `collect/`, `codescan/`, `engine/`, `model/`, `score/`, `plan/`, `shims/`,
`report/`), `rules/`, `queries/`, `fixture/`, `scripts/`, `tests/`.

### Phase 1 — Skorpyron: the demo fixture

A small, original demo application, "Arcwine" (a cellar inventory with members, tasting notes, label
images and a live tasting room; *proposed*), built as a Supabase CLI project. It exists only to be scanned;
it is never deployed.

| Commit | Content |
|---|---|
| 1 | Fixture skeleton under `fixture/`: the Supabase project directory with its config file, pinned CLI and database versions (PostgreSQL 17), and scripts to start, reset and stop the local database (`supabase db start`). |
| 2 | Core schema migrations: tenant tables, memberships, foreign keys to `auth.users`, a column defaulting to `auth.uid()`, a trigger on `auth.users` that creates a profile row, and seed data (synthetic). |
| 3 | Access control: policies calling each auth helper (including the `(select auth.uid())` form and JWT-claim reads), policies and grants naming the built-in roles, default privileges, a view and a PL/pgSQL function that call the helpers. |
| 4 | Storage and realtime: buckets and policies on `storage.objects` using the storage helper functions; tables added to the realtime publication; a trigger calling `realtime.broadcast_changes`; policies on `realtime.messages`. |
| 5 | Platform features: Supabase-specific extensions, a database webhook, a `pg_cron` job posting to an edge function, a Vault secret reference, a queue, an auth hook function with its grants, REST-exposed functions (including a security-definer one and one executable by `anon`), a `pgrst` role setting. |
| 6 | Application code under `fixture/app/` (TypeScript, never installed or built): client creation in browser and server form, data queries with filters and modifiers, RPC, auth flows (password, OAuth, one-time code, session listener, admin and multi-factor calls), storage calls, realtime channels (database changes, broadcast, presence), function invocation, direct `fetch` calls to gateway paths, environment files with current and legacy variable names, generated database types. |
| 7 | Edge functions under the project's `functions/` directory: one using the injected environment and a service-role client, one webhook receiver with JWT verification off, a shared module, per-function configuration. |
| 8 | Negative controls: portable tables, a policy using only standard PostgreSQL, upstream extensions, a private-schema function, and code that looks like SDK use but is not (`Array.from`, an unrelated `.from()` builder, a same-named variable). |
| 9 | `fixture/manifest.yaml`: every planted feature with an id, its feature area, its location (database object or `file:line`) and whether it is a tie or a control; a live test asserting each database entry exists and an offline test asserting each code entry does. |
| 10 | CI workflow `ci-fixture` booting the database and running the live tests; the "changing the fixture" workflow file; `fixture/README.md`; release-notes entry. |

Sign-off: the demo's domain and name; the feature inventory (commits 2–8) against the evidence base — what
is added or dropped; the manifest format; the pinned CLI and image versions; the hard cases the code must
contain for static analysis (re-exported client, wrapper function, destructured methods, dynamic table
name).

Rules for the fixture: all data is synthetic; no real key, token or project reference appears (placeholders
that the secret scan accepts); each planted feature is the documented pattern, with its source noted in the
manifest.

### Phase 2 — Trilliax: database scan, terminal and JSON

Gul'dan's first form: `nightwell audit --db-url …` prints a terminal summary and writes JSON.

| Commit | Content |
|---|---|
| 1 | The model (`src/model/`): finding (stable id, rule id, feature area, category, severity, confidence, location, evidence, message, sources), the three severities, the categories and the six areas, each defined once; the versioned JSON Schema of the report. |
| 2 | The connection: read-only transaction at repeatable-read, statement and lock timeouts, the connection string from a flag or an environment variable and never echoed; clear errors for refused, unauthorised and insufficient-privilege cases; the SQL to create a least-privilege scanner role, documented. |
| 3 | Catalog queries as data under `queries/` (policies, grants and default privileges, role memberships and settings, foreign keys, triggers and event triggers, publications, extensions, functions with their exposure, views, cron jobs, webhook registrations, bucket configuration) and the collector that runs them into a catalog snapshot (Telemancy); `check-queries` proving each file is one `SELECT` over allowed relations. |
| 4 | The rule engine (Chronomatic Anomaly): the rule-file format and its JSON Schema, the pack manifest (pack version, the Supabase CLI, database-image and SDK versions it was verified against, date), matching over snapshot facts, `--rules <dir>` to load another pack. |
| 5 | The database rule pack: one rule per tie in the fixture's database manifest, each with sources; platform-owned objects (Supabase's own event triggers, internal schemas' own contents) excluded by rules, not by code. |
| 6 | `check-rules`: every rule is schema-valid, cites an accepted source and fires on the fixture; every tie in the manifest is hit by a finding; no control is reported as a tie. |
| 7 | Renderers (Aluriel): the terminal summary (banner, counts by area and severity, findings grouped by area, the pack version) and the JSON report; `--format`, `--out`, quiet and no-colour modes; exit codes. |
| 8 | `nightwell snapshot` and `audit --snapshot`; the committed fixture snapshot with a live test that a fresh one is identical; `nightwell rules list` and `rules explain <id>`. |
| 9 | Read-only proof: a live test that a scan leaves the fixture's schema and row counts unchanged and succeeds under a role with no write privilege. Golden tests for both outputs. Docs, the "adding or changing a rule" and "adding a collector query" workflow files, release-notes entry. |

Sign-off: the finding shape and the JSON schema; the category list; the full rule table (rule, area,
category, severity, source) — every severity is the owner's call; the allowed-relations list (*proposed*:
system catalogs, `information_schema`, and named configuration relations of Supabase-managed schemas —
never `auth.users`, `storage.objects` or any user table's rows, never a decrypted secret); how expressions
are matched (*proposed*: recorded catalog dependencies first, tokenised definition text for function
bodies); the terminal layout from a sample; flag names and exit codes (*proposed*: 0 success, 1 gate
failed, 2 usage or connection error).

Severity meaning (*proposed*): **portable** — moves to plain PostgreSQL unchanged; **needs a replacement** —
works once a like-for-like substitute or shim exists; **needs a redesign** — depends on a platform service
with no drop-in equivalent.

### Phase 3 — Tel'arn: application code scan

`nightwell audit --code <dir>` adds code findings; with both inputs the report joins them.

| Commit | Content |
|---|---|
| 1 | Source discovery: which files are scanned, ignore rules, generated and vendored code skipped, size limits; nothing is executed and no dependency is installed. |
| 2 | Client tracking: values created by the SDK's client factories, followed through imports, re-exports, wrapper functions and destructuring; a finding is `certain` when the chain is proven and `probable` otherwise. |
| 3 | The code rule pack, by family: data queries, RPC, auth, storage, realtime, function invocation, superseded helper packages; each rule cites the SDK source or reference it was read from. |
| 4 | Environment and gateway rules: variable names in code and environment files (names only, R9), gateway URL paths and host shapes in literals, key-format prefixes. |
| 5 | Edge functions and project configuration: function directories, their configuration, injected-variable use, declared auth hooks and exposed schemas, in all three config-file forms. |
| 6 | Cross-links: a code finding names the database object it reaches where that is static (a table in `from('…')`, a function in `rpc('…')`, a bucket, a channel's table). |
| 7 | Coverage (`check-rules` extended to code), golden tests, terminal and JSON additions, docs, release-notes entry. |

Sign-off: the tracking approach and what counts as `certain`; the code rule table with severities; the
default ignore list; how `probable` findings are shown and whether they count toward scores.

### Phase 4 — Krosus: dependency score

| Commit | Content |
|---|---|
| 1 | The score definition as data (weights, bands) and its domain document. |
| 2 | Per-area computation over findings and inspected items, always shown with the counts behind it. |
| 3 | Terminal and JSON output (schema version bump, additive); golden tests; property tests (no findings scores zero; adding a tie never lowers a score; a control never raises one); docs and release-notes entry. |

Sign-off: the formula. *Proposed:* per area, the severity-weighted share of inspected items that are not
portable (weights 0 / 1 / 3 for portable / replacement / redesign), from 0 (nothing ties this area to the
platform) to 100 (every item needs a redesign), with a band label and the raw counts; no single overall
number.

### Phase 5 — Elisande: compatibility shims and the portability proof

`nightwell shims --out <dir>` writes SQL files; Nightwell never applies them.

| Commit | Content |
|---|---|
| 1 | The shim format: SQL templates as data with a header (what it stands in for, the contract the application must meet, what it does not do), a matching removal script, and the rules each shim answers. |
| 2 | Auth-helper shims: `auth.uid()`, `auth.jwt()`, `auth.role()`, `auth.email()` reading the same request settings as the originals, so the caller sets one session setting per request. |
| 3 | Stand-in roles and grants: the built-in roles as plain roles, with the memberships policies rely on. |
| 4 | Reference stand-ins (owner's call at sign-off): a minimal `auth.users` so foreign keys stay valid; the storage helper functions as pure SQL. |
| 5 | Selection: only the shims a given audit needs are emitted, in apply order, with an index file. |
| 6 | Arcan'dor: a stock PostgreSQL container, the demo's own schema, the shims, and one set of policy assertions run on both databases with identical results; removal scripts leave nothing behind. |
| 7 | Findings name the shim that covers them; docs, the "adding a shim" workflow file, release-notes entry. |

Sign-off: the shim list and each one's exact semantics; whether the `auth.users` stand-in ships; the
request-setting contract; output layout. Boundary (R5): a shim keeps existing SQL valid — it authenticates
nobody, stores no file and delivers no message.

### Phase 6 — Etraeus: migration plan and options

`nightwell plan` orders the work; it prescribes no destination.

| Commit | Content |
|---|---|
| 1 | Plan steps as data: id, title, area, what it resolves (rules), what it depends on, the shim that can defer it. |
| 2 | The planner: only steps with findings appear; ordered by dependency; a stable tie-break; cycles rejected by a checker. |
| 3 | The options catalogue as data: for auth, storage, realtime, edge functions and the REST layer, the kinds of replacement and named examples, each with a public link, unranked. |
| 4 | Output: terminal, JSON (additive), and a Markdown checklist; each step lists its findings, its options and its interim shim. |
| 5 | Golden and property tests (a step never precedes its dependency); docs; release-notes entry. |

Sign-off: the step list and its dependency graph; the options catalogue entry by entry (which examples are
named, and the neutral wording); the checklist layout.

### Phase 7 — Aluriel: HTML report

| Commit | Content |
|---|---|
| 1 | One self-contained HTML file: no external request, no tracking, readable offline and when printed, light and dark. |
| 2 | Sections: summary, scores, findings with filters by area, severity and confidence, plan, shims, method (what was read, the pack version, the sources). |
| 3 | Accessibility and escaping: every value from the scanned project is escaped; keyboard and screen-reader basics; a browser smoke test on the fixture's report. |
| 4 | Golden test, the "adding an output form" workflow file, docs with a screenshot of the fixture's report, release-notes entry. |

Sign-off: the layout from a rendered sample of the fixture's report; what the summary leads with.

### Phase 8 — Tichondrius: lock-in gate and release

| Commit | Content |
|---|---|
| 1 | `nightwell check`: baseline file, comparison by stable finding id, a severity threshold, exit code 1 on new findings; documented CI usage. |
| 2 | Drift watch: the scheduled workflow on the newest Supabase CLI and image, opening or updating one issue; the "updating for a Supabase release" workflow file (what to watch, re-verify, bump). |
| 3 | Packaging: the published file list, the supported Node versions, install and `npx` smoke tests on a clean machine in CI, provenance for the published package. |
| 4 | User documentation: quick start, the scanner role, every command and flag, the report's fields, how to write a rule, limits and non-goals. |
| 5 | Release: `RELEASE_NOTES.md` entry for v0.1.0, the "releasing" workflow file, version and tag; the v0.1 section leaves this file. |

Sign-off: the baseline format and gate defaults; the npm package name and who publishes; the release
itself (publishing is done by the owner or on the owner's explicit instruction).

### Not in v0.1

- Code scans for the other client SDKs (Python, Dart and Flutter, Swift, Kotlin, C#).
- Reading project settings through Supabase's management interface (auth providers, storage settings,
  function secrets); v0.1 reads the database and the repository only.
- Static scans of SQL migration files without a database.
- Output for code-scanning dashboards (SARIF) and editor integrations.
- PostgreSQL 15 as a second live fixture.
- Anything that writes: applying shims, moving data, rewriting application code.

## After v0.1

The owner decides the next release's scope from the list above and from what users of v0.1 report; it gets
its own section here when it is planned.
