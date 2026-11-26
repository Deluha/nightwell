# Conventions

## Hard rules

The owner confirmed these rules; changing one is an ask-first item. `CLAUDE.md` carries the short form.

### R1

**Read-only.** The only statements sent to a scanned database are a fixed set: one transaction preamble
(read-only, repeatable read, `search_path = pg_catalog`, named statement, lock, idle and transaction
timeouts, all `SET LOCAL`), savepoints around each page, query files that ship inside the package, and
`ROLLBACK`. Each query file is one `SELECT` that a real PostgreSQL parser proves to have no locking
clause, no `INTO`, no data-modifying part, and only schema-qualified relations and functions from the
allow-lists. The allow-lists enumerate each relation with its columns and each function with its
signature — no class or wildcard entry — and a deny-list (password, statistics, large-object, activity
and file-access catalogs and functions) holds even if an entry is added. A relation outside the system
catalogs is read only after the catalogs show it is the expected platform table and that row security
would not run for the scanner; otherwise the gap is recorded without reading.

### R2

**Detection is data.** No Supabase identifier (schema, role, function, extension, publication, SDK
method, environment-variable name, URL path, connection hint) appears in `src/`; they live in the rule
pack. The feature-area names are the one exemption. The engine offers a closed set of generic matcher
kinds; rules combine them with all / any / not only, and match by exact value, prefix or simple glob —
never a free regular expression.

### R3

**Public sources only.** Every rule cites at least one source from the accepted-hosts list, with the
date read. Rules record facts and copy no source text. The options catalogue is not a rule and may link
any public page. Accepted hosts (additions are ask-first): Supabase's documentation site, the Supabase
organisation's repositories on GitHub, and the PostgreSQL project's site.

### R4

**The fixture proves every rule.** Every rule fires on the live fixture or on a committed variant
snapshot of it whose provenance (command, versions, date) is recorded; snapshots are generated, never
hand-written. No code, fixture or data from another project.

### R5

**Neutral and bounded.** No destination is assumed or recommended; option lists are unranked; no
replacement for auth, storage or realtime is shipped.

### R6

**One definition.** Severities, categories, feature areas and the finding shape are defined once and
imported; schema enumerations are generated from the model; every file format (report, snapshot, rule
pack, gate baseline, config) carries its own schema version.

### R7

**Docs move with the code.** A change in a documented area updates that area's document in the same
pull request, by the committed area-to-document map `scripts/data/docs-map.json`. `[skip-docs]` on its
own line in a commit message is the escape hatch, not the default.

### R8

**No files nobody asked for.** Tests live only in `tests/`; no planning, notes or progress documents
beyond the permanent docs below and `ROADMAP.md`; a checker fails on any other new Markdown file.

### R9

**Secrets never leave.** Connection strings, keys and environment-variable values are never printed,
logged or stored. Redaction is default-deny over every text the collector stores: definitions are kept
as identifier and keyword tokens, and every literal, long number and comment is replaced by a
placeholder with a bucketed length and no hash, unless a rule matches on it by a kept form (a setting
name, a gateway path prefix). URLs are cut to the matched path prefix. The analyzer and every renderer
see only the redacted snapshot, on the direct path too. Evidence from code is symbol, path and call
shape, never literal text. A snapshot's header carries no host, project reference or database user;
snapshots and reports are still labelled confidential.

### R10

**Everything read is hostile.** Database values, server messages, source text and paths, snapshots, gate
baselines, configuration values and external rule packs are untrusted. Every output form encodes for
its context (terminal, CI annotations, HTML, Markdown, SARIF, SQL). An external pack holds detection
rules only: queries, allow-lists, shim templates, plan steps, options and the score definition are never
loaded from outside the package. Parsers of untrusted input have size, depth and time caps and are
fuzzed. Output is written only inside the requested target and never through a link; the code scan
reads regular files only, follows no link out of its root, resolves no module and executes nothing.

### R11

**Factual and fair.** Rule text states what an object depends on and where that is defined, never a
judgement. Every report states that a tie is a dependency, not a defect, and that Nightwell is not a
security or performance linter. Tie kind appears beside every count; ties to open source components are
never summed with ties to the hosted platform. A factual error in a rule is a bug with a response
target.

## Permanent docs

The Markdown files that may exist. `check-conventions` reads this list (one glob per line) and fails on
any other tracked Markdown file. Adding a line is a guidance change.

```permanent-docs
README.md
ROADMAP.md
CLAUDE.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
SECURITY.md
MAINTAINERS.md
RELEASE_NOTES.md
THIRD_PARTY_NOTICES.md
docs/threat-model.md
docs/stability.md
tests/README.md
.claude/**
.github/pull_request_template.md
```

## Simplicity audit

Ask of every diff, and remove what fails:

- Does each new file, function, option and dependency serve the task that was asked?
- Is there a second home for a fact, constant or definition that already has one?
- Could a reader delete this line, branch or abstraction and lose nothing?
- Is an abstraction used by exactly one caller? Inline it.
- Does a comment repeat the code? Does a name need a comment to be understood? Rename instead.

## Error handling

- Typed errors are defined in the model (from Phase 2) and thrown by library code; library code never
  exits the process, writes to the console or reads the environment.
- Errors are mapped to exit codes only in `src/cli/`.
- An error message never contains a connection string, a key, an environment-variable value or text
  read from a scanned project that has not been encoded for the terminal (R9, R10).
- Something the tool could not read is a coverage gap in the result, never an empty result.
