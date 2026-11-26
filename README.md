# Nightwell

Nightwell audits a Supabase project and reports its ties to the Supabase platform: what in the database,
the project configuration and the JavaScript or TypeScript code depends on Supabase, what the tool could
not see, and a plan for moving to plain PostgreSQL.

> **Status: in development.** No release exists yet. This build prints its version and help; the first
> release is planned in [ROADMAP.md](ROADMAP.md), and [RELEASE_NOTES.md](RELEASE_NOTES.md) records what
> has been built so far.

## What it is

- A command-line tool and a typed library, distributed through npm, for Node.js 22, 24 and 26.
- **Read-only.** Nightwell never writes to the project it scans and never migrates data. It emits files;
  you apply them.
- **Destination-neutral.** It recommends, ranks and defaults to no destination. Stock PostgreSQL is the
  yardstick for "portable", not a recommendation.
- **Factual.** A tie is a dependency, not a defect. Every detection rule is written from public sources,
  cites them, and is proven against the demo project in this repository.

## What it is not

- **Not a security or performance linter.** Supabase's own advisors do that job.
- **Not a migration tool.** It moves no data and applies nothing; Supabase's and PostgreSQL's dump
  tooling do that job.
- **Not affiliated with Supabase.** Nightwell is an independent project. It is not affiliated with,
  endorsed by or sponsored by Supabase. "Supabase" is a trademark of its owner and is used here only to
  describe what the tool examines.

## Privacy

- No telemetry. Nightwell never checks for updates and never downloads rules.
- No network access other than the database connection you give it.
- Reports and catalog snapshots describe your project's structure. They are redacted by default, but
  treat them as confidential and do not attach them to a public issue.

## Development

```sh
npm ci --ignore-scripts
npm run verify
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to contribute, [SECURITY.md](SECURITY.md) for how to
report a vulnerability, and [docs/stability.md](docs/stability.md) for what the public contract is.

## Licence

[MIT](LICENSE). See [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
