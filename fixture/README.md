# Cellarbook demo fixture

Cellarbook is a small, invented wine-cellar application on Supabase. It exists only to be scanned by
Nightwell and to prove its rules. Every value is synthetic. Never deploy it, and never replace a
synthetic value with a real one.

## Layout

| Path                    | Holds                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `supabase/`             | The CLI project directory: `config.jsonc`, `migrations/` (one per topic), `seed.sql`, `functions/` |
| `app/`                  | A small workspace of application code; never installed or built                                |
| `config-forms/`         | The project configuration in its other file forms                                              |
| `manifest.yaml`         | Every planted feature                                                                          |
| `canaries.json`         | The canary credentials                                                                         |
| `versions.env`          | The image pins, by digest                                                                      |

## Running it

Docker is required.

- `npm run fixture:start` boots the local database on PostgreSQL 17; `fixture:reset` and `fixture:stop`
  rebuild and remove it.
- `--pg 15` boots PostgreSQL 15; `--with-pooler` adds the transaction-mode pooler. Pass flags after
  `--`: `npm run fixture:start -- --pg 15`.
- `NIGHTWELL_FIXTURE_LATEST=1` runs the newest CLI and images, unpinned.
- Live tests run with `NIGHTWELL_LIVE=1 npx vitest run tests/fixture` against a started fixture.

## The manifest and the oracle

`manifest.yaml` has one entry per planted feature: its id, feature area, kind (a tie, or a control that
must not be one), location, public sources and, for database entries, the oracle mode. An offline test
holds it to the files; a live test holds it to the running database.

The oracle dumps the non-managed schemas from the running fixture and loads them into stock PostgreSQL
17, one statement at a time, twice: as stock ships (`bare`), and with a plain stand-in for each role the
dump names that stock lacks (`roles`). Controls must load and behave the same. A tie that fails to load
declares `fails_on`, the platform schemas and roles its own failure must name; an entry that names a
schema must also fail in the `roles` pass on a schema, so a missing role cannot stand in for a missing
schema. A tie that loads must give a different probe outcome, rows or SQLSTATE. A failure that only
follows an earlier failed object is a cascade: listed and committed, not counted as proof. Grants to platform
roles that no entry lists (most come from the platform's default privileges) are listed apart as
platform ACL and never prove anything. A mismatch means the manifest is wrong.

## Canaries

`canaries.json` lists fake credentials that are planted in the fixture so tests can prove that nothing
sensitive is printed or stored. They are allow-listed in the secret scan by exact value. They must never
be replaced by real values.

## Hostile content

Names, literals and comments contain markup, terminal escapes, CI-annotation syntax, quotes, newlines
and path separators, written as escapes. A tool that reads the fixture must encode them for its output.

## Changing it

Follow `.claude/skills/nightwell-development/references/workflows/changing-the-fixture.md`.
