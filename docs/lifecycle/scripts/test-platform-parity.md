# Test Platform Parity Script Lifecycle

## Metadata

- **Script**: test-platform-parity
- **Status**: active
- **Version**: 0.5.0
- **Owner**: automation-engineer
- **Last Updated**: 2026-10-31 (v0.5.0 transform-aware L0→L1 parity for the four platform instruction files, spec 2026-10-31-platform-parity-transform-check-design)

## Description

Platform parity verifier for ADR-0033 (audit.ts gate; `bun scripts/test-platform-parity.ts [--verbose]`).
The four platform instruction files (CLAUDE.md, GEMINI.md, CODEX.md, HERMES.md) are transform-verified
at L0→L1: the checker recomputes the publisher's own `applyGovernanceTransforms`
(`scripts/propagate-to-templates.ts --governance-l1`, dev-sync step 4.51 / ADR-0077 D11) on the L0
content and requires the L1 copy to match byte-for-byte, with one volatile-marker tolerance
(`Last Updated: <date>` — the pre-commit hook re-dates committed files one-sidedly; annotation text
stays verified). `agents/pm.md` keeps its extends/section-rules logic across L0→L1→L2. Mismatches
FAIL with a concise summary (first divergent line + lengths, not a full diff). SSOT:
`scripts/SCRIPTS.md` registry row.

## Phase History

| Date | From | To | Change | Actor |
|------|------|----|--------|-------|
| 2026-10-31 | production | production | v0.5.0 (spec docs/designs/2026-10-31-platform-parity-transform-check-design.md; user-directed inspection finding 2026-10-31): existence-only L0→L1 branch replaced with transform-aware parity (recompute `applyGovernanceTransforms`, byte-compare after `Last Updated` date normalization); closes the 2026-09-25-verifier-platform-expansion-design D3.5 CODEX/HERMES parity deferral and the ADR-0093 informational-only gap; dead PARITY_RULES entries for CLAUDE.md/GEMINI.md removed (no consumer outside this file); main() guarded behind import.meta.main (module now imported by tests/unit/platform-parity-transform.test.ts — 7 hermetic fixture tests: tamper FAIL, transformed-equal PASS, stale-L0 FAIL, missing-file FAIL, stamp-date tolerance PASS, stamp-text enforcement FAIL, normalizer unit pins). | automation-engineer |
| 2026-09-27 | production | production | v0.4.0 (ADR-0093, spec docs/designs/2026-09-27-hermes-md-instruction-file-design.md): FILE_MAPPINGS gains HERMES.md L0→L1 informational existence check; no PARITY_RULES entry invented. | automation-engineer |
| 2026-09-25 | - | production | v0.3.0 (spec docs/designs/2026-09-25-verifier-platform-expansion-design.md site 11 / D11): FILE_MAPPINGS gains CODEX.md informational existence check; CODEX/HERMES section parity explicitly deferred (D3.5) — closed by v0.5.0. Versions prior predate the record-backfill convention (record created at v0.5.0 per Check H parity). | automation-engineer |

## Acceptance Criteria

### Production Phase

- [x] Platform parity gate is Fail-capable in audit.ts and detects real L0→L1 drift (demonstrated 2026-10-31: caught the in-flight graft→trail L1 staleness the existence-only check passed)
- [x] The four platform instruction files are verified against the publisher transform, not existence-only
- [x] Hermetic unit fixtures pin tamper/transformed-equal/missing-file/tolerance semantics
- [x] Registry row + this record agree on the version (Check A/H parity)

## Dependencies

- `scripts/propagate-to-templates.ts` (`applyGovernanceTransforms` — import-safe behind `import.meta.main`; no import cycle)
- `scripts/audit.ts` (subprocess gate, exit-code contract 0/1/2)
- `.githooks` pre-commit (`Last Updated` re-dating — source of the volatile-marker tolerance)

## Notes

- The v0.5.0 tolerance is date-token-only by design: the publisher emits no stamps, but the
  pre-commit hook re-dates any committed file carrying `Last Updated:`, so L0 and L1 dates can
  legitimately differ between same-content pairs (observed at HEAD on GEMINI.md, 2026-10-26 vs
  2026-10-31). The annotation text after the date remains byte-verified.
