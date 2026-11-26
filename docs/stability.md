# Stability policy

## The public contract

- The command-line interface: commands, flags and exit codes.
- The file formats: report, catalog snapshot, rule pack, gate baseline and configuration file. Each
  carries its own schema version.
- Finding ids and rule ids.
- The exported API.

Everything else — module layout, internal functions, message wording, the order of unordered output —
may change in any release.

## Versions

- During 0.x, a breaking change ships only in a minor version and is listed under "Breaking" in the
  release notes.
- A patch release may add rules and correct false positives or false negatives. It never changes an
  existing rule's id or severity.
- A deprecation warns on standard error for one minor version before removal.
- Rule ids are never reused. A retired or split rule names what replaces it.

## Supported runtimes

Node.js 22, 24 and 26. The binary checks the version before it does anything else.

## Scanned servers

PostgreSQL 15 and 17 are tested. PostgreSQL 14 and 16 are accepted and reported as untested.
