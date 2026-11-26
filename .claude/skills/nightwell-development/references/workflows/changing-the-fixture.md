# Workflow: changing the fixture

For any change under `fixture/`: a planted feature, a control, a canary or a pin. What the fixture is
and how to run it: `fixture/README.md`.

## Preconditions

- ⚑ Ask first when the change touches an ask-first item (for example an exclusion of a path from a
  scanner or gate, or an accepted source host). Guidance and CI changes follow `changing-guidance.md`.
- Docker is running; a session without it stops and tells the owner.
- Read the rules for the fixture in `ROADMAP.md` (Phase 1): synthetic data, a documented pattern, a source.

## Steps

1. Read the public source at a pinned commit and cite it (R3), with the date read, in the manifest.
2. Add the object in a new migration under `fixture/supabase/migrations/`, with a `-- planted: <id> (tie|control)`
   comment; or in code under `fixture/app/` or `fixture/supabase/functions/`, with a `// planted:` comment.
   Sources are recorded in the manifest only; a new migration comment says nothing about them (the
   `-- source:` lines already there stay). Never edit a migration that is already committed.
3. Data is synthetic. A canary comes only from `fixture/canaries.json` and is allow-listed by exact
   value in `.gitleaks.toml`. Hostile text is written with escapes, never raw control bytes.
4. Add the entry to `fixture/manifest.yaml`: id, area, kind, location, sources, oracle mode. A source that
   does not show the planted shape is kept with a `note: "Unverified: …"` saying what it does show. A
   `load-fails` entry also lists `fails_on`, the platform schemas and roles its own failure names; a probe
   mode needs a probe that names one of the entry's own objects. Keep each tie's failure its own: one
   statement per cause, so no tie is proven by another's error.
5. Boot on 17 and on 15 (`npm run fixture:start`, `npm run fixture:start -- --pg 15`) and run the oracle.
6. A mismatch means the manifest is wrong: correct the entry, never the oracle's verdict rules.
7. A pin changes only in `fixture/versions.env`, read from the registry on the day, with its digest.

## Verification

- `npm run verify` passes.
- `NIGHTWELL_LIVE=1 npx vitest run tests/fixture` on PostgreSQL 17; the manifest live test
  (`tests/fixture/manifest.live.test.ts`) on PostgreSQL 15.
- The secret scan passes (the hooks run it); no real key, host or project reference appears.

## Docs to update

- `fixture/README.md` for the layout or the way it is run; `../qa-and-ci.md` for a script or a pin.
- The release-notes entry.
