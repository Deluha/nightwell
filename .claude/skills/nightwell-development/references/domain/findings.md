# Findings

The definitions below are fixed by `ROADMAP.md`. The finding's exact shape, its id derivation and the
category list are signed off in Phase 2 and are then defined once in the model (R6); until then nothing
here is to be implemented.

## Severity

| Severity | Meaning |
|---|---|
| `portable` | Moves to plain PostgreSQL unchanged |
| needs a replacement | Works once a like-for-like substitute or shim exists |
| needs a redesign | Depends on a platform service with no drop-in equivalent |

Stock PostgreSQL of the fixture's major version is the yardstick for `portable`, not a recommended
destination. Every rule's severity is the owner's call.

## Confidence and target

- Confidence has three steps: certain, probable, possible. Static analysis and text matching cannot
  always prove a tie; the report says so.
- `target` is separate: static, dynamic or unknown.

## Tie kind

PostgreSQL extension; open source service; hosted platform only. Tie kind appears beside every count,
and ties to open source components are never summed with ties to the hosted platform (R11).

## Feature areas

Database, auth, storage, realtime, edge functions, REST layer. These names are the one exemption from
R2.
