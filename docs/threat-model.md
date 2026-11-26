# Threat model

Nightwell reads a project that its user may not fully trust — a database catalog, source code,
configuration — and produces reports that are read in terminals, browsers, CI systems and issue
trackers. This document states what is protected, from whom, and which test proves each control.

## Assets

| Asset                                             | Why it matters                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------------- |
| The scanned database                              | Must not be changed, locked for long, or made to run code on the scanner's behalf |
| Secrets of the scanned project                    | Connection strings, keys and literal values must not reach any output             |
| The user's machine and CI                         | Output and scanned content must not execute anything or write outside the target  |
| The integrity of a report and of the lock-in gate | A report must not claim "nothing found" for what was not read                     |
| The published package                             | Users must receive what was built and tested from this repository                 |

## Adversaries

| Adversary                 | Capability                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| A hostile scanned project | Controls object names, definitions, comments, source text, paths and configuration values |
| A hostile input file      | Controls a snapshot, a gate baseline, a configuration file or an external rule pack       |
| A hostile pull request    | Changes code, suppressions, configuration, or this project's own guidance and CI          |
| A supply-chain attacker   | Publishes a malicious dependency or tampers with a build                                  |

## Trust boundaries

- Everything read is untrusted: database values, server messages, source text and paths, snapshots,
  baselines, configuration and external rule packs.
- Trusted: the package's own code, queries, allow-lists, shim templates, plan data and built-in rule
  pack, as published from this repository.
- This repository's guidance, CI and scripts are trusted only after a maintainer has read a change to
  them.

## Controls

Controls in force today. A checker fails if a row names no test or a test that does not exist.

| #   | Control                                                                                                                                                | Test                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| C1  | The offline suite cannot open a network or database connection                                                                                         | `tests/setup/offline.test.ts`               |
| C2  | No platform identifier is hard-coded in the source; detection stays reviewable data                                                                    | `tests/checkers/conventions.test.ts`        |
| C3  | Only the command-line layer exits the process, writes to the console or reads the environment                                                          | `tests/checkers/conventions.test.ts`        |
| C4  | The production dependency tree equals a committed list, has no install script, and every lockfile entry comes from the registry with an integrity hash | `tests/checkers/conventions.test.ts`        |
| C5  | No secret file or build artifact is tracked                                                                                                            | `tests/checkers/conventions.test.ts`        |
| C6  | An outside pull request cannot change guidance, CI, scripts or scanner configuration unread                                                            | `tests/checkers/path-guard.test.ts`         |
| C7  | Protected paths have code owners, and the guidance stays consistent with the tree                                                                      | `tests/checkers/guidance-integrity.test.ts` |
| C8  | The binary refuses an unsupported runtime and rejects unknown input with a usage error                                                                 | `tests/cli/run.test.ts`                     |

## Planned controls

These arrive with the feature they protect; each moves into the table above, with its test, in the
phase named.

| Control                                                                                                  | Phase   |
| -------------------------------------------------------------------------------------------------------- | ------- |
| Only the fixed, read-only statement set is sent to a scanned database; the statement log proves it       | 2       |
| Default-deny redaction of everything the collector stores; canary credentials never appear in any output | 2       |
| Every output form encodes untrusted values for its context                                               | 2, 8, 9 |
| Parsers of untrusted input have size, depth and time caps and are fuzzed                                 | 2       |
| Scan limits and lock budgets hold on large and hostile catalogs                                          | 3       |
| The code scan reads regular files only, follows no link out of its root and executes nothing             | 4       |
| Shim SQL carries no value from the scanned project; the self-check reports unsafe setups                 | 6       |
| The lock-in gate takes its configuration from the trusted branch under an untrusted pull request         | 9       |
| Releases are built once, published with provenance and compared after publishing                         | 10      |

## Non-goals

- **A hostile server at protocol level.** Nightwell defends against hostile content in a database, not
  against a server that attacks the client through the wire protocol.
- **A committer who obfuscates code.** The code scan and the lock-in gate are drift guards. They do not
  stop someone with commit rights who deliberately hides a dependency.
- **Shims are not authentication.** The compatibility shims keep existing SQL valid. They authenticate
  nobody and trust the settings the application provides.
