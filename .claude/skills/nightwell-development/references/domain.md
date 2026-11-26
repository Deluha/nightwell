# Domain

## Terms

| Term | Meaning |
|---|---|
| Finding | One rule match on one subject |
| Tie | A finding whose severity is not `portable`. A tie is a dependency, not a defect |
| Control | A fixture entry that must yield no tie; it may yield a `portable` finding |
| Item | A database object or a code call site |
| Pack | The built-in rule set: one manifest, one version, split into files by family |
| Coverage status | What the tool could and could not read, per collector query or scanned input |
| Platform inventory | The objects present on an empty project for given versions |
| Platform fingerprint | The extension versions and managed-schema migration versions of a scanned project |
| Gate baseline | The committed audit that the lock-in gate compares against |

## Domain files

| Concept | File | Arrives |
|---|---|---|
| Findings, severities, confidence, tie kinds | `domain/findings.md` | Phase 0 (terms), Phase 2 (shape) |
| Rule-file format and matcher kinds | `domain/rule-files.md` | Phase 0 (constraints), Phase 2 (format) |
| Score, plan, shims | one file each | Phases 5, 7, 6 |
