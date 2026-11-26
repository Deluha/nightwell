# Rule files

The constraints below are fixed (R2, R3, R4, R11). The file format and the matcher vocabulary are
signed off in Phase 2; until then no rule is written.

- Rules are data in the pack, never code. The pack is one manifest with one version, split into files by
  family.
- The engine offers a closed set of generic matcher kinds. A new kind is an ask-first item.
- Rules combine matchers with all / any / not only, and match by exact value, prefix or simple glob —
  never a free regular expression.
- Every rule cites at least one accepted source with the date read, records facts and copies no source
  text.
- Every rule fires on the fixture, and the fixture's manifest lists the exact rule ids expected on each
  entry.
- Rule text states what an object depends on and where that is defined, never a judgement.
- Rule ids are never reused; a retired or split rule names what replaces it (see `docs/stability.md`).
