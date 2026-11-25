# Nightwell — Roadmap

The planned scope of the next release. `RELEASE_NOTES.md` (created in Phase 0) records what shipped; this
file records what is planned. A release's section leaves this file when the release is tagged. Owner
decisions are dated; items marked *proposed* are defaults the owner has not yet confirmed.

## v0.1 — First public release

Goal: a command-line tool and library that audits a Supabase project, reports everything that ties it to
the Supabase platform, and gives a plan for moving to plain PostgreSQL.
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
  roles) so existing policies on the user's own tables keep working on plain PostgreSQL during a gradual
  migration.

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
- **Quality bar.** A state-of-the-art open source project following current industry practice for a CLI and
  library: a typed public API, a stated stability policy, a hardened supply chain, a tested security model.
- **Delivery.** One pull request per phase, several commits each.
- **Phase order.** Phase 0 (foundations) runs first, in a development environment that can reach a hosted
  Supabase database; Phase 1 is the demo fixture; Phase 2 the database scan with terminal and JSON output.
  The rest is ordered below (*proposed*).
- **Sign-off.** Each phase lists what the owner confirms before its code is written.
- **Reviewed.** This plan was revised on 2026-11-25 after two independent reviews (project and release
  practice; technical design). Their accepted findings are folded into the phases.

### The hosted database (rules for its use)

The development environment for Phase 0 can reach a real, hosted Supabase database. It is evidence, not a
test subject:

- It is read **only**, through `SELECT` on system catalogs and Supabase-managed schemas, in a read-only
  transaction. Nothing is created, changed or applied there.
- Only **platform facts** are recorded (which roles, schemas, extensions and settings the platform creates;
  how connections, privileges and visibility behave). No name, definition or row of that project's own
  objects, no host, project reference or credential is written into the repository, a commit message, a
  pull request or a report.
- The tests still run against the demo fixture only. A hosted **reference snapshot** of the demo project
  itself (Phase 2) is a separate step that needs a throwaway project — the owner's call at the Phase 1
  sign-off.

### Proposed additions (owner to confirm at the Phase 0 sign-off)

| # | Proposal | Why |
|---|---|---|
| A1 | **Catalog snapshot** (Telemancy): the database scan is a collector that writes a redacted catalog snapshot and an analyzer that reads it; `nightwell snapshot` exports one, `nightwell audit --snapshot` analyses it without a connection | Offline tests; users can inspect exactly what was read; audits where the tool may not reach the database |
| A2 | **Library API**: the CLI is a thin layer over a typed, exported API (`collectSnapshot`, `analyze`, `loadRulePack`, `render`, the model types) | Integrators need not shell out; retrofitting an API later is a breaking change |
| A3 | **Coverage status**: every collector query reports `complete`, `relation-absent`, `no-privilege` or `row-filtered`; a gap is shown in every output and marks the area incomplete | A scanner role that cannot see a relation must never read as "nothing found" |
| A4 | **Portability proof** (Arcan'dor): the demo schema is loaded into a stock PostgreSQL; controls must load, ties must not, and with the shims the same policy assertions pass on both databases | Makes severities and shims tested facts, not opinions |
| A5 | **Lock-in gate** (Tichondrius): `nightwell check` compares an audit with a committed baseline and fails on new findings; suppressions need a reason | During a gradual migration, stops new ties being added |
| A6 | **Drift watch**: a scheduled job boots the fixture on the newest Supabase CLI and images and reports rule, baseline or snapshot differences in an issue | Supabase changes internals between releases |
| A7 | **Project configuration scan**: the Supabase config file (`config.toml`, `config.json`, `config.jsonc`) is read for exposed schemas, edge-function settings and auth hooks | These are declared there, not in the database |
| A8 | **Three-step confidence** on findings (certain / probable / possible) and a separate `target` field (static / dynamic / unknown) | Static analysis and text matching cannot always prove a tie; the report says so |
| A9 | **Tie kind** on each finding: PostgreSQL extension, open source service, hosted platform only | "Tied to a component you can self-host" and "tied to the hosted platform" are different kinds of lock-in |
| A10 | **SARIF and Markdown** output next to terminal, JSON and HTML | Code-scanning dashboards and issue trackers |
| A11 | **JavaScript and TypeScript only** for the code scan in v0.1 | Other SDK languages follow (see Not in v0.1) |

### Codenames

Each feature is named after a Nighthold encounter; supporting pieces take names from Suramar. Codenames
never replace module, file, command or JSON field names. Where they appear (contributor docs only, or also
banners and reports) is a Phase 0 sign-off item, because the names are another company's trademarks.

| Codename | Feature | Phase |
|---|---|---|
| **Gul'dan** | Lead feature: the lock-in audit — `nightwell audit` and the lock-in report it produces | 2, completed through 7 |
| **Skorpyron** | The demo Supabase project (test fixture) | 1 |
| **Trilliax** | The database scan: the read-only collector that sweeps the catalog | 2 |
| **Chronomatic Anomaly** | The versioned rule packs and the rule engine | 2 |
| **Spellblade Aluriel** | The report renderers, one per form | 2, 7, 8 |
| **High Botanist Tel'arn** | The application code scan (syntax trees) | 3 |
| **Krosus** | The dependency score per feature area | 4 |
| **Grand Magistrix Elisande** | The compatibility shims: echoes of the platform that keep old policies working | 5 |
| **Star Augur Etraeus** | The migration plan and the options catalogue | 6 |
| **Tichondrius** | The lock-in gate (`nightwell check`) | 8 |
| **Arcan'dor** | The portability proof on stock PostgreSQL | 1 (oracle), 5 (proof) |
| **Telemancy** | The catalog snapshot | 2 |

### Evidence base (public sources, read 2026-11-25)

Planning inputs only: they decided the scope and the fixture's contents. They are not rules. Every rule
written in Phases 2 and 3 re-reads its own source and cites it. Sources are the open source repositories
under `github.com/supabase` (the documentation was read from its source in `supabase/supabase` under
`apps/docs/content/`, because `supabase.com` was not reachable from the development environment).

| Area | Finding | Source |
|---|---|---|
| Auth helpers | `auth.uid()`, `auth.role()`, `auth.email()`, `auth.jwt()` read the `request.jwt.claim.*` / `request.jwt.claims` settings; `auth.uid()` casts the subject to `uuid`. The database image carries older definitions of the first three; `auth.jwt()` and the current bodies are installed by the Auth service's migrations | `supabase/auth` `migrations/20220224000811_update_auth_functions.up.sql`, `20220531120530_add_auth_jwt_function.up.sql`; `supabase/postgres` `migrations/db/init-scripts/00000000000001-auth-schema.sql` |
| Roles | `anon`, `authenticated`, `service_role`, `authenticator`, `supabase_admin`, the `supabase_*_admin` service roles, `dashboard_user`, `pgbouncer` and others; the reserved list is in the supautils configuration | `supabase/postgres` `migrations/db/init-scripts/`, `ansible/files/postgresql_config/supautils.conf.j2` |
| Scanner role | No read-only role is documented for customers; `supabase_read_only_user` is internal | docs `guides/database/postgres/roles.mdx` |
| Managed schemas | The CLI keeps an internal-schema list (`auth`, `storage`, `realtime`, `vault`, `extensions`, `graphql`, `graphql_public`, `supabase_functions`, `supabase_migrations`, `cron`, `net`, `pgmq`, `pgsodium`, …). `storage.buckets` has row-level security enabled, so a non-owner reads zero rows | `supabase/cli` `apps/cli/src/commands/inspect/db/inspect-schemas.ts`; `supabase/postgres` storage init script |
| Realtime | Publication `supabase_realtime`; database-side broadcast through `realtime.send` / `realtime.broadcast_changes`; authorization through policies on `realtime.messages` (a partitioned table created by the Realtime service) using `realtime.topic()` | `supabase/postgres` `migrations/schema-17.sql`; `supabase/realtime` `priv/repo/tenant_schema/realtime/` |
| Webhooks | Triggers executing `supabase_functions.http_request(...)`, built on `pg_net`; header values (often keys) sit in the trigger definition. `supabase_functions.hooks` is the invocation audit trail, not the registration | docs `guides/database/webhooks.mdx`; `supabase/supabase` `docker/volumes/db/webhooks.sql` |
| Extensions | Supabase-maintained: `pg_graphql`, `pg_net`, `supabase_vault`, `pg_jsonschema`, `wrappers`, `index_advisor`, `supautils`; deprecated on PostgreSQL 17: `pgjwt`, `plv8`, `plls`, `plcoffee`, `timescaledb`; `pgsodium` pending deprecation | `supabase/postgres` `nix/ext/versions.json`; docs `guides/platform/upgrading.mdx` |
| REST layer | The exposed-schema list is gateway configuration (the config file locally, a dashboard setting on hosted projects), defaulting to `public`, `graphql_public`; functions there are RPC endpoints; default privileges in `public` grant to the API roles, and that default is being withdrawn for new projects | docs `guides/api/securing-your-api.mdx`, `guides/api/using-custom-schemas.mdx`; `supabase/cli` `packages/config/src/api.ts` |
| Connections | Direct connections are IPv6 unless an add-on is bought; the shared pooler is IPv4 and its username carries the project reference; the transaction-mode pooler supports neither named prepared statements nor session-level `SET` | docs `guides/database/connecting-to-postgres.mdx` |
| Client SDK | `supabase-js` v2 (v3 in prerelease): `from`, `schema`, `rpc`, `channel`, `auth.*`, `storage.*`, `functions.invoke`; server packages `@supabase/ssr`, `@supabase/server`; `@supabase/auth-helpers-*` superseded | `supabase/supabase-js` `packages/core/*/src/` |
| Edge functions | `supabase/functions/<name>/index.ts`; injected `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_JWKS`, legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | docs `guides/functions/secrets.mdx` |
| Gateway | Paths `/rest/v1`, `/auth/v1`, `/storage/v1`, `/realtime/v1`, `/functions/v1`, `/graphql/v1` and others; hosts `<ref>.supabase.co`, pooler hosts; key formats `sb_publishable_…` / `sb_secret_…` beside the legacy JWT keys | `supabase/supabase` `docker/volumes/api/kong.yml`; docs `guides/getting-started/api-keys.mdx` |
| Other ties | Vault secrets (the root key is held outside the database, so secrets must be read on the source before a move), `pg_cron` jobs calling `net.http_post` to edge functions, auth hooks as PostgreSQL functions granted to `supabase_auth_admin` (declared in config or the dashboard, not in the database), queues (`pgmq`), foreign data wrappers | docs `guides/database/vault.mdx`, `guides/functions/schedule-functions.mdx`, `guides/auth/auth-hooks.mdx`, `guides/queues/api.mdx` |
| Fixture runtime | `supabase db start` (CLI v3, pinned) starts only the database yet runs the auth, storage and realtime schema migrations; the webhook objects are installed only when `experimental.webhooks.enabled` is set. The CLI supports PostgreSQL 14–17 locally, default 17 | `supabase/cli` `apps/cli/src/command-internal/db-bootstrap/db-setup.ts`, `packages/config/src/experimental.ts`, `packages/config/src/db.ts` |
| Project config | Since CLI 3.4.0 `supabase init` writes `supabase/config.jsonc`; `config.toml` and `config.json` are still read | docs `guides/local-development/cli/config-formats.mdx` |

**Assumptions not yet verified** (reasoned from general PostgreSQL knowledge; Phase 0 commit 10 verifies
each on the hosted database or a local PostgreSQL and moves it into the table above, or corrects the plan):

| # | Assumption | Decides |
|---|---|---|
| U1 | `cron.job` is filtered by row-level security to the current user; `information_schema` views show only objects the caller has privileges on | The allowed-relations list and coverage statuses (Phase 2) |
| U2 | Catalog dependencies record references in policy expressions, views, defaults and `BEGIN ATOMIC` functions, but nothing for PL/pgSQL or string-bodied functions, string constants or role names, and are not transitive | The three matching sources (Phase 2) |
| U3 | A read-only transaction still allows side effects through function calls (`dblink`, `pg_notify`, advisory locks, `set_config`) and temp-table writes | The query checker's function allow-list (Phase 2) |
| U4 | Deparsed expressions omit a schema qualifier when the schema is on `search_path` | Collecting under `search_path = pg_catalog` (Phase 2) |
| U5 | A table owner, a superuser and a `BYPASSRLS` role are not subject to policies | The shim contract and self-check (Phase 5) |
| U6 | The exposed-schema list of a hosted project is not stored in its database | The `--exposed-schemas` input (Phase 2) |
| U7 | The Node PostgreSQL driver verifies the certificate chain for `sslmode=require`, and Supabase's certificate authority is not in Node's default trust store | TLS flags and error messages (Phase 2) |
| U8 | What a hosted project contains that the local CLI database does not (roles, extensions, settings, webhook objects, dashboard-created webhook shape) | The hosted reference snapshot and platform baseline (Phase 2) |
| U9 | A single explicit transaction with `SET LOCAL` works through the transaction-mode pooler | The connection design (Phase 2) |

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
9. **The hosted database.** Used only under the rules of "The hosted database" above.

### Phase 0 — Foundations

The way of working and the project's public shape, set up before any product code. Self-contained: this
section is the specification.

| Commit | Content |
|---|---|
| 1 | Toolchain and package shape: package manifest (ES modules only, an `exports` map, `types`, `bin`, `files`, `engines`, the SPDX licence field), compiler and lint-and-format configuration, test runner, a committed lockfile, the `nightwell` binary printing its version and help, an empty public entry point, `.editorconfig`, `.gitignore`, a development-container definition. |
| 2 | `CLAUDE.md`: the always-loaded contract — operating principles, the workflow for any change, the hard rules in short form with pointers, the ask-first list. Budget: at most 80 lines and 8 KiB. |
| 3 | The development skill `.claude/skills/nightwell-development/`: `SKILL.md` as a routing table naming the one file that holds each task's detail, and its `references/` (below). |
| 4 | Agents in `.claude/agents/`: `implementer`, `reader`, `reviewer`, `scribe` (below). |
| 5 | Path rules in `.claude/rules/` and thin command skills (`/verify`, `/review-diff`, `/guidance-change`), each pointer-only. |
| 6 | Checkers and the verify command in `scripts/`, with their tests (below). |
| 7 | `.claude/settings.json` and `.claude/hooks/`: permissions, a session-start hook that installs the development tools in cloud sessions, a post-edit hook that lints the edited file and feeds failures back. |
| 8 | Git hooks and CI (below): hook configuration; workflows `ci-pre-commit`, `ci-docs-sync`, `ci-tests`, `ci-package`, static analysis, dependency review, supply-chain scorecard; dependency-update configuration; code owners; secret-scan configuration. |
| 9 | Project and community documents (below). |
| 10 | Hosted verification: assumptions U1–U9 checked read-only on the hosted database (or a local PostgreSQL where the platform is not involved); each result moves into the evidence table with how it was verified and the date, and any phase text it contradicts is corrected in the same commit. Scratch queries are not committed. |

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
| R1 | **Read-only.** The only statements sent to a scanned database are one fixed transaction preamble (read-only, repeatable read, `search_path = pg_catalog`, timeouts, all `SET LOCAL`), query files under `queries/`, and `ROLLBACK`. Each query file is one `SELECT` that a real PostgreSQL parser proves to have no locking clause, no `INTO`, no data-modifying part, only schema-qualified relations and functions from the allow-lists, and no user-defined function, operator or view. Rows are read only from system catalogs and the named configuration relations on the allow-list. |
| R2 | **Detection is data.** No Supabase identifier (schema, role, function, extension, publication, SDK method, environment-variable name, URL path) appears in `src/`; they live in the rule packs. The engine offers a closed set of generic matcher kinds; rules combine them with all / any / not only. |
| R3 | **Public sources only.** Every rule cites at least one source on Supabase's documentation site or under `github.com/supabase`, with the date read. Rules record facts and copy no source text. |
| R4 | **The fixture is the only test subject.** Every rule fires on the live fixture or on a committed variant snapshot of it whose provenance (command, versions, date) is recorded; variant snapshots are generated, never hand-written. No code, fixture or data from another project. |
| R5 | **Neutral and bounded.** No destination is assumed or recommended; option lists are unranked; no replacement for auth, storage or realtime is shipped. |
| R6 | **One definition.** Severities, categories, feature areas and the finding shape are defined once and imported; every file format (report, snapshot, rule pack, baseline, config) carries its own schema version. |
| R7 | **Docs move with the code.** A change in a documented area updates that area's document in the same pull request (`[skip-docs]` on its own line in a commit message is the escape hatch, not the default). |
| R8 | **No files nobody asked for.** Tests live only in `tests/`; no planning, notes or progress documents beyond the permanent docs and this file. |
| R9 | **Secrets never leave.** Connection strings, keys, environment-variable values, and any credential found inside scanned objects (trigger arguments, cron commands, option arrays, setting values, function bodies) are never printed, logged, or written into a report or snapshot; the collector redacts before it stores. A snapshot's header carries no host, project reference or database user. |
| R10 | **Scanned content is hostile.** Database values, source text and third-party rule packs are untrusted. Every output form encodes for its context (terminal control characters, HTML, Markdown, SQL identifiers). Rule packs are pure data, loaded with a safe parser and size limits. Patterns run in linear time. Output paths stay inside the requested target; the code scan follows no symlink out of its root and executes nothing. |

**Ask first** (*proposed*): the severity, category, area and tie-kind definitions and any rule's severity;
the score definition; the plan's steps and edges; the options catalogue; shim SQL semantics; the exported
API; a breaking change to any file format, the CLI's flags or its exit codes; the relation and function
allow-lists of the collector; a new matcher kind; the list of accepted public-source hosts; a new runtime
dependency; and the guidance machinery and CI (`CLAUDE.md`, `.claude/settings.json`, agents, hooks,
workflows, hook and secret-scan configuration), which `permissions.ask` also gates mechanically.

**Skill references** (each a single home; `SKILL.md` gets exactly one routing row per file):
`conventions.md` (hard rules in full, simplicity audit, error handling), `style.md` (comments, terminal
messages, CLI flags: one flag name per concept, one wording per situation), `architecture.md` (module map,
operating model, codenames, tech stack), `domain.md` and the domain files it indexes (findings, severities
and confidence; rule-file format and matcher kinds; later score, plan, shims), `qa-and-ci.md` (hook gates,
the verify command, workflows, how a session reaches the fixture and the hosted database, README and
dependency policy), `checkers.md` (what each checker parses), `recipes.md` (grep-before-coding commands,
orchestration and the subagent brief, the Implementation Decision format, the lessons loop), `workflows/`
(one step-by-step file per recurring task, each with Preconditions, Steps, Verification, Docs to update
and ⚑ Ask first: changing guidance; later adding or changing a rule, changing the fixture, adding a
collector query, adding a shim, adding an output form, updating for a Supabase release, releasing), and
`evals/evals.json` (routing and ask-first prompts run by hand in a fresh plan-mode session before a
guidance change merges).

**Agents** (model tiers named only in the agent frontmatter and one roles table; never a `model` on the call):

| Agent | Tier | Tools | Role |
|---|---|---|---|
| `implementer` | mid-tier model, medium effort (high on the call for bug fixes and edge-case-heavy work) | Read, Grep, Glob, Edit, Write, Bash | Implements exactly the brief (goal, files, exact change, constraints, acceptance criteria), runs the targeted checks and pastes their raw output; stops at ambiguity or an ask-first item |
| `reader` | small model, medium effort | Read, Grep, Glob | Read-only sweeps; conclusions with `file:line`, never dumps |
| `reviewer` | session model, high effort | Read, Grep, Glob, Bash | Reviews a diff it did not write against the acceptance criteria, the hard rules, the simplicity audit and the style conventions; reports verified findings, most severe first; never edits |
| `scribe` | small model, medium effort | Read, Write | Notes and drafts outside the repository tree, never committed |

**Checkers** (each a pure function with tests; the verify command runs all of them plus lint, type-check and
tests, never stops at the first failure and prints one pass/fail table):

- `check-conventions`: the mechanical code rules, starting with R2 (the forbidden list is generated from
  the identifiers in `rules/` minus a reviewed list of ordinary words, and applied to identifiers and
  string literals in `src/` through the syntax tree), no tracked secret or build artifact, thin command
  entry files, and no process exit, console write or environment read outside `src/cli/`.
- `check-guidance-integrity`: every backticked path and `#anchor` in the guidance resolves; the `CLAUDE.md`
  budget; one routing row per reference file; a rule heading (`R<n>`) has one home; path rules and command
  skills stay pointer-only (at most 6 body lines).
- `check-docs-sync`: a code change in a documented area touches that area's document; run on each commit
  message locally and against the pull-request base in CI.

**Gates:** git hooks at commit (secret scan of staged changes, conventions, lint, guidance integrity), at
commit-message (docs sync) and at push (the fast tests). CI repeats every hook on the whole tree, scans the
pull request's commits and the tree for secrets with a pinned, checksum-verified scanner, runs tests with
coverage, the type-check and workflow linters, and ends in one `CI gate` check to require. Supply chain:
every workflow starts from read-only permissions and widens per job; no workflow runs untrusted
pull-request code with secrets; third-party actions are pinned to a commit hash; checkouts do not persist
credentials; installs use the lockfile with install scripts off; dependency updates are grouped and wait a
minimum release age; pull requests get a dependency review and a licence allow-list check; static analysis
covers the code and the workflows; a scorecard workflow reports the project's supply-chain posture.
`ci-package` packs the tarball, installs it into an empty directory and runs the binary on Linux, macOS
and Windows on every supported Node line, and lints the package's export map and types.

**Lessons loop:** a review finding or repeated mistake is fixed twice: in the code and in the cheapest guard
that stops it recurring — a checker rule or test, then a hook or permission, then one line in the rule's
single home, or nothing with the reason stated in the pull request. When a checker starts enforcing
something, the prose that asked for it is replaced by a pointer.

**Tests:** `tests/` is the only test location. The offline suite runs on a bare checkout, on all three
operating systems and every supported Node line, with network and database connections blocked by the
harness, not by convention; live tests run on Linux. Paths in output are POSIX-style and relative. Golden
files pin output; they are regenerated only for an intended change through an explicit switch, the diff is
the reviewable proof, and a missing golden file fails. Coverage thresholds fail CI (*proposed*: 90% of
lines and branches for the engine, model, score and plan modules; 80% overall).

**Project and community documents** (commit 9): `README.md` (what it is, a statement that Nightwell is
independent and not affiliated with or endorsed by Supabase, no telemetry and no network access other than
the database connection); `CONTRIBUTING.md` (a path that needs no particular editor or assistant: the
verify command, how to add a rule with its source and fixture entry, the commit convention, sign-off of
contributions); `CODE_OF_CONDUCT.md`; `SECURITY.md` (supported versions, private reporting, response
targets, scope including report injection and secret leakage, the credentials model); `MAINTAINERS.md`
(who decides, how rules and severities are accepted); `docs/stability.md` (below); `RELEASE_NOTES.md`
(with "v0.1.0 — in development"); `THIRD_PARTY_NOTICES.md` and a `NOTICE` on the codenames; `tests/README.md`;
issue forms (bug, false positive or missed tie, Supabase change, feature) and the pull-request template
(Summary; Changes; Docs updated; QA gates run; Review agents run — maintainers; Not tested live / to do by
hand; Lessons; Rule-pack changes with sources and fixture coverage; Ask-first items touched).

**Stability policy** (`docs/stability.md`, *proposed*): the public contract is the CLI's commands, flags
and exit codes; the file formats; finding and rule ids; the exported API. During 0.x a breaking change
ships only in a minor version and is listed under "Breaking" in the release notes. A deprecation warns on
standard error for one minor version before removal. Rule ids are never reused; a retired or split rule
names what replaces it.

**Owner checklist** (repository and registry settings a session cannot change): require `CI gate` on the
default branch and forbid force-pushes; turn on private vulnerability reporting, secret-scanning push
protection and dependency alerts; reserve the npm package name (`nightwell` was unclaimed on 2026-11-25).

Sign-off: proposals A1–A11; the tech stack, supported Node lines and runtime dependency list; the hard
rules and the ask-first list as worded above; the repository layout; agent tiers; coverage thresholds; the
stability policy; where codenames appear and name clearance for "Nightwell" as a public product name
(package registry, code host, trademark search — the owner's call); sign-off of contributions (*proposed*:
a developer certificate of origin, no contributor licence agreement); whether the guidance checker skips
paths this file names for phases not yet built.

Tech stack (*proposed*, confidence medium-high):

| Approach | For | Against |
|---|---|---|
| **TypeScript on Node.js**, distributed through npm (`npx nightwell`) | The audience already has Node; one language for tool, checkers and fixture app; mature parsers for the code to be scanned | The parser is a sizeable runtime dependency |
| Python | Mature SQL and CLI tooling | A second runtime for Supabase users; JavaScript parsing needs a bundled grammar |
| Go or Rust | Single static binary | Slowest to build; JavaScript analysis is weakest |

Selected: TypeScript; Node lines 22, 24 and 26 (every line supported upstream, enforced by `engines`);
runtime dependencies limited to a PostgreSQL driver, a YAML parser, a JSON Schema validator, a PostgreSQL
parser (for the query checker) and one JavaScript/TypeScript parser — the choice between the TypeScript
compiler in syntax-only mode and a lighter parser is a sign-off item, with its size and its upcoming API
changes weighed; argument parsing and colour from Node built-ins. Layout (*proposed*): `src/` (`cli/`,
`collect/`, `codescan/`, `engine/`, `model/`, `score/`, `plan/`, `shims/`, `report/`, `index.ts`),
`rules/`, `queries/`, `schema/`, `fixture/`, `scripts/`, `tests/`, `docs/`.

### Phase 1 — Skorpyron: the demo fixture

A small, original demo application, "Arcwine" (a cellar inventory with members, tasting notes, label
images and a live tasting room; *proposed*), built as a Supabase CLI project. It exists only to be scanned.

| Commit | Content |
|---|---|
| 1 | Fixture skeleton under `fixture/`: the Supabase project directory with its config file (experimental webhooks enabled), the CLI version and every image pinned by digest (PostgreSQL 17), and scripts to start, reset and stop the local database (`supabase db start`). |
| 2 | Core schema migrations: tenant tables, memberships, foreign keys to `auth.users`, a column default, a check constraint and a generated column that call an auth helper, a trigger on `auth.users` that creates a profile row, a partitioned table, and synthetic seed data. |
| 3 | Access control: policies calling each auth helper (including the `(select auth.uid())` form, JWT-claim reads and a direct read of the request setting), a policy that reaches a helper only through a security-definer function, policies and grants naming the built-in roles, default privileges, a view, a materialized view and a PL/pgSQL function that call the helpers, a function using dynamic SQL. |
| 4 | Storage and realtime: buckets created by SQL (no storage service runs) and policies on `storage.objects` using the storage helper functions; tables added to the realtime publication; a trigger calling `realtime.broadcast_changes`; policies on `realtime.messages`. |
| 5 | Platform features: Supabase-specific extensions, calls qualified with the `extensions` schema, a database webhook, a `pg_cron` job posting to an edge function, a Vault secret reference, a queue, a foreign server, an auth hook function with its grants, REST-exposed functions (including a security-definer one and one executable by `anon`), a `pgrst` role setting. |
| 6 | Application code under `fixture/app/` (TypeScript, never installed or built), as a small workspace: client creation in browser and server form, data queries with filters and modifiers, RPC, auth flows (password, OAuth, one-time code, session listener, admin and multi-factor calls), storage calls, realtime channels (database changes, broadcast, presence), function invocation, direct `fetch` calls to gateway paths, environment files with current, legacy and framework-prefixed variable names, generated database types. |
| 7 | Edge functions under the project's `functions/` directory: one using the injected environment and a service-role client, one webhook receiver with JWT verification off, a shared module, per-function configuration, each import-specifier form. |
| 8 | Hard cases for static analysis: a re-exported client, an async wrapper factory, destructured methods, a class field, a context or hook accessor, an auto-imported composable, a single-file component, a dynamic table name. |
| 9 | Controls and hostile content. Negative controls: portable tables, a policy using only standard PostgreSQL, extensions that ship with stock PostgreSQL, a private-schema function, a string or comment that merely mentions a helper, a plain database driver or query builder pointed at the database, and code that looks like SDK use but is not. Canary credentials (placeholders the secret scan accepts) inside the webhook headers, the cron command, a role setting and a foreign-server option. Hostile identifiers and literals containing markup, terminal escapes, quotes and path separators; a function and operator in `public` that shadow built-in names; a canary function that leaves a trace if anything calls it. |
| 10 | `fixture/manifest.yaml`: every planted feature with an id, its feature area, its location (database object or file and symbol), its source, and whether it is a tie or a control; a live test asserting each database entry exists and an offline test asserting each code entry does. |
| 11 | The oracle (Arcan'dor, first half): the demo's own schema is dumped from the live fixture and loaded into a stock PostgreSQL 17 container; every database control must load and behave the same, every database tie must fail to load or behave differently. A mismatch means the manifest is wrong. |
| 12 | CI workflow `ci-fixture` running the live tests and the oracle; the "changing the fixture" workflow file; `fixture/README.md`; release-notes entry. |

Sign-off: the demo's domain and name; the feature inventory (commits 2–9) against the evidence base — what
is added or dropped; the manifest format; the pinned versions; whether a throwaway hosted project may
receive the demo's migrations once per release for the hosted reference snapshot (Phase 2 commit 10) —
without it, hosted-only shapes stay untested and the report says so.

Rules for the fixture: all data is synthetic; no real key, token or project reference appears; each
planted feature is the documented pattern, with its source in the manifest; SQL adapted from a Supabase
repository carries a header naming the source and its licence.

### Phase 2 — Trilliax: database scan, terminal and JSON

Gul'dan's first form: `nightwell audit` against a database prints a terminal summary and writes JSON.

| Commit | Content |
|---|---|
| 1 | The model (`src/model/`): finding (id, rule id, feature area, category, severity, confidence, tie kind, target, location, evidence, message, sources, the fact source that matched), each enumeration defined once; the finding id as a hash of rule id and subject identity (kind, schema-qualified name, argument signature, parent — never an object identifier, line number, message, severity or pack version); JSON Schemas for report, snapshot and rule file under `schema/`, each with a stable identifier and a schema version. |
| 2 | The connection: the string from environment variables, a file or standard input (a flag value is accepted with a warning); one explicit read-only transaction with every setting `SET LOCAL`; no named prepared statements; TLS required and verified for non-local hosts, a flag for a certificate-authority file, verification never silently off; distinct errors for refused, unauthorised, certificate-chain, unreachable-over-IPv4 and pooler-username cases; the SQL to create a least-privilege scanner role, documented and live-tested against the owner role's result. |
| 3 | Catalog queries as data under `queries/`, set-based and paginated, each with a total order: object inventory (schemas, tables with their row-security flags, routines, ownership), policies, grants at every level and default privileges, role memberships and settings, database settings, foreign keys, defaults, constraints and generated columns, triggers and event triggers, publications and replica identity, extensions with their schema, functions, views and materialized views, foreign servers and tables, security labels, comments, cron jobs, bucket configuration, queue and secret names. `check-queries` enforces R1 with a PostgreSQL parser. The relation and function allow-lists are data. |
| 4 | The collector and the snapshot (Telemancy): coverage status per query; the redaction pass (R9) with a count of what was redacted; canonical form (no object identifiers, sorted, volatile fields left out or kept in a header that is not compared); partitions rolled up to their parent; extension-owned objects tagged; one object's deparse failure is a recorded gap, not a failed scan. |
| 5 | Fact extraction, three sources named on each finding: recorded catalog dependencies; tokenised definition text for every expression and body, collected with every name qualified, by a lexer that handles quoting, dollar quoting, comments and escapes; and transitive closure — a routine that reaches a tie taints its callers, reported with the path and one confidence step lower when the link is text-only. |
| 6 | The rule engine (Chronomatic Anomaly): the closed matcher vocabulary; the rule-file format; `applies_when` predicates over observed facts (an object exists, an extension's version range) instead of platform version numbers; the pack manifest (pack version, pack-format version, the CLI, database-image, service-image and SDK versions it was verified against, date, rule-id changelog); `--rules <dir>` and whether it replaces or extends the built-in pack; fuzz tests on the rule loader and snapshot reader. |
| 7 | The platform baseline: the identities of every object on an empty project for the versions in the pack manifest, generated from the fixture runtime with no migrations applied. An object in a managed schema is user-added if it is absent from the baseline; when the scanned project's platform fingerprint differs from the manifest, baseline-derived findings drop to `probable` and the report says so. |
| 8 | The database rule pack: one rule per tie in the fixture's database manifest, each with sources; extensions in three classes (ships with PostgreSQL; third-party open source — "portable where the destination offers it"; Supabase-maintained); exposure computed as (schema in the exposed list) and (effective privileges of the API roles), the list taken from `--exposed-schemas`, else the project config file, else the documented default labelled "assumed". |
| 9 | `check-rules`: every rule is schema-valid, cites an accepted source and fires on the fixture; every tie in the manifest is hit by a finding; no control is reported as a tie; ids are unique and identical across two fresh boots. |
| 10 | Variant snapshots: PostgreSQL 15 from a local boot, and — if signed off in Phase 1 — a hosted reference snapshot of the demo applied to a throwaway project with one webhook created through the dashboard. Each is generated by `nightwell snapshot`, redacted, committed with its provenance, and analysed in the offline suite. |
| 11 | Renderers (Aluriel) and the CLI contract: the terminal summary (counts by area and severity, findings grouped by area, coverage gaps, the pack version) and the JSON report; results on standard output, everything else on standard error; colour only on a terminal, with the usual environment switches and a flag; deterministic JSON; `--format`, `--out` (never overwriting without `--force`); a configuration file with a published schema, found upward from the working directory, holding paths, ignore globs, exposed schemas, format and gate settings and never credentials, with flag over environment over file; help with examples; `nightwell snapshot`, `audit --snapshot`, `rules list`, `rules explain <id>`, and a listing of every relation the collector reads. |
| 12 | The public API (`src/index.ts`), which the CLI alone calls, with a committed API report diffed in CI. Proofs: a scan leaves the fixture unchanged, succeeds under a role with no write privilege, triggers neither the shadowing objects nor the canary function, and works through a transaction-mode pooler container; a role lacking each grant produces a named gap, never an empty result; no canary credential and no part of the connection string appears in any output, snapshot, error or stack trace; reformatting does not change a finding id; a generated catalog of 5,000 tables and 10,000 policies scans within the time budget. Golden tests validated against the schemas; a scheduled, non-blocking mutation-testing job on the engine; docs, the "adding or changing a rule" and "adding a collector query" workflow files, release-notes entry. |

Sign-off: the finding shape, id derivation and the JSON schema; the category list and tie kinds; the full
rule table (rule, area, category, severity, tie kind, source) — every severity is the owner's call; the
allow-lists (*proposed*: system catalogs and built-in catalog functions; `cron.job`, `storage.buckets`
without timestamps, queue metadata, secret names and ids — never `information_schema`, `auth.users`,
`storage.objects`, the webhook audit trail, a decrypted secret, or any user table's rows); what the
redaction pass keeps (*proposed*: setting names and URL paths; every other literal in the listed positions
becomes a length and a hash prefix; full function bodies only with an explicit flag); the scan time budget
and behaviour on timeout; the terminal layout from a sample; flag and configuration names; exit codes
(*proposed*: 0 success; 1 findings at or above the gate threshold; 2 usage or configuration error;
3 connection or runtime error; 4 scan incomplete).

Severity meaning (*proposed*): **portable** — moves to plain PostgreSQL unchanged; **needs a replacement** —
works once a like-for-like substitute or shim exists; **needs a redesign** — depends on a platform service
with no drop-in equivalent. The oracle of Phase 1 decides between portable and not; Phase 5's proof decides
what a shim covers.

### Phase 3 — Tel'arn: application code scan

`nightwell audit --code <dir>` adds code findings; with both inputs the report joins them.

| Commit | Content |
|---|---|
| 1 | Source discovery: package manifests and lockfiles first (SDK packages with versions, workspaces, each package reported as a unit); JavaScript and TypeScript in all module and JSX forms; script blocks of single-file components; runtime import maps; ignore rules; generated and vendored code skipped; size limits; no symlink followed out of the root; nothing executed, no dependency installed. |
| 2 | Client tracking and the evidence ladder, as data: `certain` — data flow from an SDK factory import, through re-exports, wrappers and destructuring; `probable` — a type annotation naming an SDK type, a framework-convention accessor, or an auto-import enabled only when the manifest declares the framework module; `possible` — receiver-name and call-shape only, shown separately and off in the gate by default. `target` records whether the table, function, bucket or channel argument is static, dynamic or unknown. |
| 3 | The code rule pack, by family: data queries, RPC, auth, storage, realtime, function invocation, superseded helper packages, REST-specific query syntax; each rule cites the SDK source or reference it was read from. |
| 4 | Environment and gateway rules: variable names in code and environment files (names only), framework prefixes, gateway URL paths and host shapes in literals, raw requests carrying SDK-shaped headers, key-format prefixes, pooler hosts in connection strings. |
| 5 | Portable paths: a plain driver, query builder or ORM pointed at the database is reported as a portable data-access path, with only its Supabase-specific parts as ties; generated database types as a low-severity artefact. |
| 6 | Edge functions and project configuration: function directories, their configuration, injected-variable use, declared auth hooks (which raise the matching database finding to `certain`) and exposed schemas, in all three config-file forms. |
| 7 | Cross-links: a code finding names the database object it reaches where that is static. Code finding ids use path, enclosing symbol, normalised call and ordinal — never a line number. |
| 8 | Coverage (`check-rules` extended to code), golden tests, the canary and hostile-content tests repeated for code input, a performance budget on a generated corpus (*proposed*: 5,000 files in under 60 seconds and 1.5 GB), terminal and JSON additions, docs, release-notes entry. |

Sign-off: the parser; the tracking approach and the ladder; the code rule table with severities; the
default ignore list; how `probable` and `possible` findings are shown and counted.

### Phase 4 — Krosus: dependency score

| Commit | Content |
|---|---|
| 1 | The score definition as data and its domain document. |
| 2 | Per-area computation, always shown with the counts behind it; an area with a coverage gap is labelled incomplete. |
| 3 | Terminal and JSON output (additive); golden tests; property tests; docs and release-notes entry. |

Sign-off: the definition. *Proposed:* per area, two things that are never fused — **exposure**, the count
of distinct tied items by severity (an item is a database object or a call site, counted once at its worst
finding), which sets the band on a saturating scale; and, where the area has a meaningful denominator
declared in the score data (database: tables, routines and policies outside managed schemas; REST layer:
relations and routines reachable by the API roles), the **share** of items that are tied. Code-only areas
show no share. `probable` and `possible` findings are counted in separate columns. No single overall
number. Properties tested: adding a tie never lowers exposure or band; adding a control changes no band;
raising a severity lowers nothing.

### Phase 5 — Elisande: compatibility shims and the portability proof

`nightwell shims --out <dir>` writes SQL files; Nightwell never applies them.

| Commit | Content |
|---|---|
| 1 | The shim format: SQL templates as data with a header (what it stands in for, the contract the application must meet, what it does not do), a matching removal script, and the rules each shim answers. Every shim object carries a marker comment; apply scripts fail if the object exists without the marker; removal scripts drop only marked objects. |
| 2 | Auth-helper shims with the current bodies of `auth.uid()`, `auth.jwt()`, `auth.role()`, `auth.email()`. The contract, per transaction: the application verifies the token itself, switches to the stand-in role from a login role that does not inherit it, and sets the claims as a transaction-local setting. The header states that policies are not enforced for the table owner, superusers or bypass roles, and that the subject must be the old user id. |
| 3 | Stand-in roles and grants: the built-in roles as plain roles, with the memberships policies rely on; a variant for services that do not allow a bypass role. |
| 4 | A self-check function shipped with the shims, reporting: the current role bypasses row security; tables with policies owned by the login role without forced row security; claims set at session level. |
| 5 | Reference stand-ins (owner's call at sign-off): an `auth.users` table whose columns are generated from the audit's recorded column dependencies, so foreign keys and reads stay valid; an `extensions` schema alias for qualified extension calls. |
| 6 | What shims never cover, each with an explicit finding: policies on `storage.objects` and `realtime.messages` (no service enforces them on plain PostgreSQL); triggers on managed tables; triggers that call platform functions ("writes to this table fail on the target until this trigger is dropped or replaced"). |
| 7 | Selection: only the shims a given audit needs are emitted, in apply order, with an index file; emitted SQL quotes every identifier taken from the scanned project. |
| 8 | Arcan'dor, second half: after the selected shims, the statements of the demo schema that still fail to load on stock PostgreSQL must equal exactly the objects reported as not shim-covered; one set of policy assertions runs on both databases through the three-step contract as a non-owner role, including negative cases (another subject sees nothing; an owner connection is caught by the self-check); removal leaves nothing behind. The proof's claim is stated as "policies on user tables outside managed schemas". |
| 9 | Findings name the shim that covers them; docs, the "adding a shim" workflow file, release-notes entry. |

Sign-off: the shim list and each one's exact semantics; whether the `auth.users` stand-in and optional
no-op stubs for platform trigger functions ship; the contract wording; output layout. Boundary (R5): a
shim keeps existing SQL valid — it authenticates nobody, stores no file and delivers no message.

### Phase 6 — Etraeus: migration plan and options

`nightwell plan` orders the work; it prescribes no destination and no single strategy.

| Commit | Content |
|---|---|
| 1 | Plan steps as data: id, title, area, what triggers it (findings of given rules, a predicate over facts, or always), what it resolves, and edges that are hard or soft-with-a-shim, each optionally conditional on findings. |
| 2 | The planner: a layered partial order (steps in one layer are unordered; the tie-break is for display only); cycles rejected by a checker. |
| 3 | The step list, including steps no finding triggers (destination extension check, data move, running both sides, cut-over, key rotation, verification) and the real constraints: user-id continuity before any dependent data load; roles, then the stand-in schema, then schema, then policies; storage bytes and metadata before storage policies are retired; a realtime replacement before the publication and broadcast triggers go; secrets read on the source before the move; webhook, cron and outbound-request triggers active on exactly one side while both run. |
| 4 | The options catalogue as data: for auth, storage, realtime, edge functions and the REST layer, the kinds of replacement and named examples, each with a public link, unranked. |
| 5 | Output: terminal, JSON (additive) and a Markdown checklist; each step lists its findings, its options and its interim shim. |
| 6 | Golden and property tests (no hard edge is violated; a soft edge holds when its shim is not selected); docs; release-notes entry. |

Sign-off: the step list and its edges; the options catalogue entry by entry (which examples are named, and
the neutral wording); the checklist layout.

### Phase 7 — Aluriel: HTML report

| Commit | Content |
|---|---|
| 1 | One self-contained HTML file: no external request, no tracking, a content-security policy that allows nothing but its own hashed style and script, readable offline, with scripts disabled and when printed, light and dark. |
| 2 | Sections: summary, scores, coverage gaps, findings with filters by area, severity, confidence and tie kind, plan, shims, method (what was read, the pack version, the sources), and the independence statement. |
| 3 | Escaping and accessibility: every value from the scanned project is encoded for its position, embedded data included; WCAG 2.2 AA — an automated accessibility check with no violations in the browser smoke test, contrast in both themes, severity never shown by colour alone (also in the terminal), semantic headings and tables. |
| 4 | Golden test, the hostile-content and canary tests repeated for HTML, the "adding an output form" workflow file, docs with a screenshot of the fixture's report, release-notes entry. |

Sign-off: the layout from a rendered sample of the fixture's report; what the summary leads with.

### Phase 8 — Tichondrius: lock-in gate and release

| Commit | Content |
|---|---|
| 1 | `nightwell check`: baseline file (recording pack version, coverage statuses and where the exposed-schema list came from), comparison by finding id mapped through rule replacements, a severity threshold; findings that are new only because the pack changed form a separate, non-failing class by default; comparing audits with different coverage is refused; suppressions in the configuration file by finding id or rule and object, each with a required reason and an optional expiry, listed in the report. |
| 2 | SARIF 2.1.0 output validated against its schema, and annotations for the code host's pull-request view. |
| 3 | A documented, smoke-tested CI recipe: boot the user's own project locally, audit database and code, then check. |
| 4 | Drift watch: the scheduled workflow on the newest Supabase CLI and images, opening or updating one issue with least privilege; the "updating for a Supabase release" workflow file (what to watch, re-verify, bump). |
| 5 | Rule-pack distribution: packs are bundled; the pack has its own version, printed in every report; the engine states the pack-format range it accepts and rejects others clearly; rule-only updates ship as patch releases; Nightwell never downloads rules or checks for updates. |
| 6 | Packaging: final check of the published file list against a golden, a tarball size budget, the install matrix. |
| 7 | User documentation: quick start, the scanner role, connection guidance for hosted projects, every command and flag (generated from the CLI definition), the report's fields, a rule reference generated from the rule files and linked from each finding, how to write a rule, limits and non-goals. |
| 8 | The release workflow: started by the owner (a protected environment with the owner as required reviewer), publishing through the registry's trusted-publisher mechanism with provenance and no stored token; a software bill of materials and the tarball checksum attached to the release; a signed tag. At least one release candidate goes out under a pre-release tag first. |
| 9 | Release: the supply-chain best-practices self-assessment completed; `RELEASE_NOTES.md` entry for v0.1.0; the "releasing" workflow file (including re-taking the hosted reference snapshot); version and tag; the v0.1 section leaves this file. |

Sign-off: the baseline format and gate defaults; who may trigger the release workflow; the release itself
(publishing happens only on the owner's explicit instruction).

### Not in v0.1

- Code scans for the other client SDKs (Python, Dart and Flutter, Swift, Kotlin, C#).
- Reading project settings through Supabase's management interface (auth providers, storage settings,
  function secrets); v0.1 reads the database and the repository only.
- Static scans of SQL migration files without a database.
- A documentation website with versioned docs; shell completion; report translations (v0.1 is English).
- A separately published or signed rule pack; a wrapper action for CI; editor integrations.
- Anything that writes: applying shims, moving data, rewriting application code.

## After v0.1

The owner decides the next release's scope from the list above and from what users of v0.1 report; it gets
its own section here when it is planned.
