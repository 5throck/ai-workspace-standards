# Design: §11.0 supported-surface registry validator (T-20261001-018)

- **Spec ID**: 2026-10-01-surface-registry-validator
- **Date**: 2026-10-01
- **Status**: implemented
- **Source**: manual (governance backlog T-20261001-018; ADR-0097 follow-up)

## Problem

The §11.0 coverage rule (eight surfaces at L0/L1/L2) was enforced only by
review and the installer tests — ADR-0097's recorded enforcement-honesty gap.

## Decision

`scripts/validate-surface-registry.ts` (1.0.0, L0-only, @l2-propagate false):
- Parses the 8-row §11.0 table from CONSTITUTION.md as the single source.
- One-source check: templates/common/docs/context.md must carry the same 8
  rows verbatim (raw-row compare — reconstructed rows would drop qualifiers
  like "(Code tab, bundled CLI)").
- Per layer (L0 root, L1 templates/common, every L2 templates/co-*):
  instruction files exist; platform dirs per family exist (.claude/.gemini/
  .agents/.codex/.hermes); L2 skills mirror into every shipped platform dir
  (`mirror: false` honored, ADR-0075). CLAUDE/GEMINI/CODEX.md are
  SCAFFOLD_COMPOSED — new-project composes them from the L1 copy — so the L2
  static check excludes them ("or is delivered at scaffold"); AGENTS.md and
  HERMES.md ship statically and are checked.
- Documented gaps live in `docs/surface-gaps.json` ({surface, check, reason,
  fallback, ticket}) — matching findings render WARN with the ticket id;
  everything else FAILs. Seeded empty.
- audit.ts runs it with `--strict` as a gate (same spawnSync pattern as
  check-upgrade-coverage); `--strict` additionally refuses WARNs.

Division of labor: verify-platform-lifecycle keeps L0/L1 mirror-parity checks;
this validator owns the §11.0 registry-vs-tree coverage including L2 skills.

## Accessibility

Non-UI tooling change — no accessibility impact (per ADR-0065).

## Preview Verification

Non-UI change — no rendered-preview verification required (per ADR-0070).

## Verification

- tests/unit/validate-surface-registry.test.ts — 9 pass (parsing, live-tree
  integration, synthetic FAIL/gap-WARN/mirror:false/one-source drift)
