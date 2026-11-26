# Tests

`tests/` is the only place tests live; a checker fails on a test file anywhere else.

| Path                   | Holds                                                                    |
| ---------------------- | ------------------------------------------------------------------------ |
| `tests/setup/`         | The offline harness, loaded before every test file                       |
| `tests/cli/`           | The command-line interface                                               |
| `tests/checkers/`      | The repository checkers in `scripts/checkers/`                           |
| `tests/hosted-verify/` | The shape of the hosted verification queries in `scripts/hosted-verify/` |

## Running

- `npm test` runs the offline suite. `npm run verify` runs it with every other gate.
- `npm run test:coverage` adds coverage; the thresholds in `vitest.config.ts` fail the run.

## The offline suite

The offline suite runs on a bare checkout, on Linux, macOS and Windows and on every supported Node line.
`tests/setup/offline.ts` blocks outgoing network connections, so a test that tries to reach a network or
a database fails instead of passing by accident.

## Live tests

Live tests need Docker and run on Linux only; they arrive with the fixture. A live test that cannot run
is reported as skipped, never as passed.

## Golden files

Golden files pin output. They are regenerated only for an intended change, through an explicit switch;
the diff is the reviewable proof, and a missing golden file fails the test.

## Conventions

- Paths in expected output are POSIX-style and relative.
- Test data is synthetic. No real key, token, host or project reference appears in a test.
