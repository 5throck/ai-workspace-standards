# Design: Equal-Version L0/L1 Content Drift Gate

- **Spec id**: `2026-10-05-equal-version-l0l1-drift-gate-design`
- **Date**: 2026-10-05
- **Status**: Implemented
- **Ticket**: T-20261004-022
- **Related**: `scripts/verify-scripts.ts` 1.12.0, `scripts/lib/constitution-scrub.ts` 1.1.0, `scripts/propagate-to-templates.ts`, `scripts/dev-sync.ts` Step 3.7, T-20260912-005 (scrub SSOT)

## Problem

`scripts/audit.ts` (L0) and its `templates/common/scripts/audit.ts` (L1) mirror
were both at `@version 2.48.1`, yet ~9 lines differed; same for
`scripts/dev-sync.ts` / `templates/common/scripts/dev-sync.ts` at `@version
1.23.0` (~10 lines). Every line of the delta was the CONSTITUTION.md→context.md
substitution applied by the L0→L1 publish-time scrub — but applied
INCONSISTENTLY:

- Comment lines were scrubbed everywhere (sanctioned — the audit L0-leakage
  check requires it).
- Functional string literals were scrubbed at SOME sites and preserved at
  others. `templates/common/scripts/audit.ts:925` keyed its verify-memory guard
  on `context.md` while sibling root-detection checks in the same file (lines
  263, 273, 2230) kept `CONSTITUTION.md`; `dev-sync.ts:712` (`isL0Context`)
  and five user-facing message strings were likewise scrubbed.
- The version-only gates were blind to all of this, and so was the existing
  drift check: `detectDrift` normalized BOTH sides with a blanket
  CONSTITUTION.md→context.md replace, which scrubs the L0 functional literals
  too and therefore cannot see the mixed-marker class.

## Root cause

The scrubber's code-branch comment classifier (`scrubConstitutionRefs` in
`scripts/lib/constitution-scrub.ts`) wedged its block-comment state machine on
two text shapes that are NOT block comments:

1. A `/*`-shaped glob inside a `//` line (e.g. `docs/**` in a path list at
   audit.ts:10) — flipped the machine into block-comment mode, after which
   every following functional line was treated as comment text and
   blanket-scrubbed.
2. An overlapping slash-star glob in functional code (e.g. `templates/*/skills/`
   inside a dev-sync.ts:645 message string) — `/*/` contains the opener probe
   (`/*`) while the closer probe searched only AFTER the opener (idx+2) and so
   missed the overlapping `*/`; the machine stayed wedged until the next real
   block close.

## Decisions

1. **The substitution is a sanctioned publish-time canonicalization** — already
   the documented contract of `scripts/lib/constitution-scrub.ts` (comments
   scrubbed; functional string literals preserve the real L0 marker). The gate
   is built ON it, not around it: canonicalize the L0 side with the
   propagator's own implementation, then require byte equality with the raw L1
   copy.
2. **Classification, not just detection** (`classifyL0L1Pair`, exported):
   - `in-sync` — canonical(L0) === L1 byte-for-byte (any version combination);
   - `equal-version-divergence` — matching `@version` headers with diverging
     canonical bytes → ERROR in `--verify`, exit 1 in `--check-drift` (which
     dev-sync Step 3.7 already treats as blocking), hash-prefixed report;
   - `pending-publish` — version skew with content difference → warn-only
     (unchanged semantics for the ordinary pre-propagation state).
3. **Fix the scrubber, not around it** (v1.1.0): full-line `//` comments are
   classified first and scrubbed WITHOUT touching block-comment state, and the
   closer probe starts at idx+1 so overlapping `/*/` globs count as balanced.
   Byte-equality with all 110 L0/L1 registry pairs is preserved except the
   intended class (below).
4. **Repair the live mirrors to canonical form**: restore the functional
   literals the wedged machine had scrubbed — `templates/common/scripts/audit.ts:925`,
   `templates/common/scripts/dev-sync.ts:244/696/712/719/729/1417`,
   `templates/common/scripts/validate-templates.ts:2398`, plus the regenerated
   L1 `lib/constitution-scrub.ts` mirror. `dev-sync` only ever runs in L0, so
   restoring CONSTITUTION.md in its message strings costs no project-side UX.
5. **Neutralize scrub-variant comments that describe CONSTITUTION.md-checking
   code**: `audit.ts:2` ("(workspace-root marker guard)" — matching its
   SCRIPTS.md registry description), `dev-sync.ts:625` and `dev-sync.ts:711`.
   A comment that names either file gets rewritten by the scrub on every
   publish and then misdescribes the functional literal below it; a
   layer-neutral phrase is stable at both layers.

## Test plan

- `tests/unit/verify-scripts-drift-classification.test.ts` — classifyL0L1Pair
  (in-sync / equal-version-divergence / pending-publish / header-only skew /
  verbatim-unscrubbed-clone) + shortContentHash + the three scrubber
  state-machine regressions (glob in // line, overlapping `/*/` glob, real
  block comments still scrubbed inside).
- `bun scripts/verify-scripts.ts --check-drift` → 110 pairs in sync, exit 0.
- Negative: any equal-version byte divergence flips `--check-drift` to exit 1
  (pinned by the classifyL0L1Pair unit tests; Step 3.7 blocks on it).

## Non-goals / known limitations

- The scrubber still treats any `/*` in code position as a potential block
  opener (regex literals like `/CONSTITUTION\.md/` are untouched because the
  closer probe resolves them); a full lexical comment scanner is out of scope.
- Version-skew drift remains warn-only by design: publishing is an explicit
  propagate step, not a hard gate.
