# Security policy

## Supported versions

No version has been released yet. From the first release on, the latest minor version of the 0.x line
receives security fixes.

## Reporting a vulnerability

Report privately through the repository's **Security → Report a vulnerability** form (private
vulnerability reporting). Do not open a public issue, and do not attach a snapshot or a report from a
real project anywhere public.

| Step                                            | Target                                    |
| ----------------------------------------------- | ----------------------------------------- |
| Acknowledgement                                 | within 3 working days                     |
| Assessment and severity                         | within 10 working days                    |
| Fix or mitigation for a confirmed vulnerability | within 30 days; sooner for a critical one |

A factual error in a rule is a bug, not a vulnerability, but it has a response target too: an
assessment within 10 working days.

## What counts as a vulnerability

- **A redaction miss:** a secret, a literal value or a connection detail of a scanned project appears in
  an output, a snapshot, an error message or a log.
- **An injection:** content read from a scanned project, a snapshot, a baseline, a configuration file or
  a rule pack changes what Nightwell executes, or is not encoded for the output it lands in (terminal,
  CI annotations, HTML, Markdown, SARIF, SQL).
- **A statement outside the fixed set:** Nightwell sends a scanned database anything other than its
  fixed, read-only statement set.
- **A gate bypass without a configuration change:** the lock-in gate passes although a new tie was
  added and neither its configuration, its baseline nor its suppressions changed.
- A write outside the requested output directory, or a read outside the scanned root.

Not vulnerabilities: a hostile server at protocol level, a committer who deliberately obfuscates code
to evade the code scan, and the fact that the compatibility shims authenticate nobody. See
[docs/threat-model.md](docs/threat-model.md).

## Verifying a release

Releases will be published through the registry's trusted-publisher mechanism with provenance, with a
software bill of materials, a build attestation and a checksum attached. How to verify them is
documented with the first release.

## Safe usage

- Give Nightwell a least-privilege, read-only role, never the owner's connection string.
- Run it against a local copy or a replica where you can; never run a CI recipe against production.
- Treat snapshots and reports as confidential.
- Pin the version you run.
