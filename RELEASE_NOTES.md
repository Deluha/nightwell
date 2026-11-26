# Release notes

What shipped. The planned scope is in [ROADMAP.md](ROADMAP.md).

## v0.1.0 — in development

Nothing is released yet. Entries are added phase by phase and become the release entry at v0.1.0.

### Foundations (Phase 0)

- The package shape: an ES-module package for Node.js 22, 24 and 26 with a typed entry point and the
  `nightwell` binary, which checks the Node.js version first and prints its version and help.
- The project's public documents: contributing guide, code of conduct, security policy, threat model,
  stability policy and maintainers.
- The development gates: `npm run verify`, git hooks, and CI with a single required check, a secret
  scan, static analysis, dependency review and a supply-chain scorecard.

### Demo fixture (Phase 1)

- A demo project, "Cellarbook", for tests and demonstrations: schema, access control, storage and
  realtime, platform features, controls and hostile content in PostgreSQL; edge functions; application
  code in several forms. All data is synthetic. It is scanned, never deployed. See `fixture/README.md`.
- A manifest of every planted feature (feature area, tie or control, location, public source), held to
  the fixture by an offline and a live test.
- An oracle that loads the fixture's non-managed schemas into stock PostgreSQL 17, bare and with stand-in
  roles, and checks that each tie fails on the platform names it declares or differs as declared and each
  control loads; cascades are listed apart and never counted as proof.
- CI boots the fixture on PostgreSQL 17 and 15 and runs the live tests and the oracle; a manually
  started workflow uploads schema dumps and platform-object query results as artefacts.
