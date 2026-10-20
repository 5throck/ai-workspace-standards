# Constitution-Scrub Depth Relativization + ADR Target Redirect

- **Date**: 2026-10-19
- **Status**: Implemented
- **Spec ID**: 2026-10-19-constitution-scrub-depth-design
- **Related**: T-20261019-001 (this fix), T-20261017-002 / T-20261018-001 (sibling review tickets verified + closed in the same pass), `scripts/lib/constitution-scrub.ts` v1.2.0, `scripts/propagate-to-templates.ts`, `templates/common/docs/governance/agents/*.md`

## 1. Background (3rd recurrence)

Every re-propagation of the governance mirrors (`docs/governance/agents/*.md` → `templates/common/docs/governance/agents/*.md`) re-broke their links. The 10-17 template-level link fixes were correct but got re-reverted by the next mirror regeneration — the root cause lived in the transform, not the mirrors.

## 2. Defects

1. **Rule A-6 (self-reference only)**: the scrub's blanket rules emit root-depth `](docs/context.md)` targets. A-6 rewrote them only when the target itself was `docs/context.md`. A mirror three levels deep (`docs/governance/agents/workflows.md`) kept the literal — resolving to `docs/governance/agents/docs/context.md` (broken). **7 broken context links per mirror.**
2. **ADR links (no rule)**: the workflows.md mirror's `[ADR-0099](../../adr/0099-….md)` target has no projected home — L1+ trees carry no `docs/adr/` content (`templates/common/docs/adr/` is a `.gitkeep` placeholder; root `docs/adr/` is L0-only governance per §7.5). Broken in the mirror **and in every scaffold**.

## 3. Fix (constitution-scrub.ts v1.2.0)

1. **A-6 generalized**: with a `targetPath`, every emitted `](docs/context.md)` is rewritten to `path.posix.relative(dirname(inProjectTarget), '/docs/context.md')`, where `inProjectTarget` strips the `templates/<variant>/` prefix. Effects: `docs/governance/agents/*` → `../../context.md`; `docs/governance/*` → `../context.md`; root files keep the literal `docs/context.md`; `docs/context.md` itself keeps the self-reference-free `context.md` (old A-6 behavior, subsumed). No `targetPath` → no-op (unchanged legacy contract).
2. **New rule A-9**: link targets containing an `adr/` segment (both `docs/adr/…` and depth-relative `../../adr/…` source forms) redirect to the depth-relative context link — link text preserved, anchors dropped (A-5b policy).

## 4. Tests

`tests/unit/scrub-constitution-refs.test.ts` v1.1.0: the v1.1.0 "any other targetPath is a no-op" contract was the defect — replaced with the depth contract: (b) context.md self-reference (templates-prefixed, Windows separators), (c) three-level deep → `../../context.md` (common + variant prefixes), (d) two-level → `../context.md`, (e) root-depth literal preserved, (f) A-9 adr redirect with text preservation, (g) A-9 anchor drop. 21/21 green (v1.1.0 code fails c/f/g).

## 5. Regeneration + Verification

`propagate-to-templates.ts --apply` re-scrubbed the mirrors: all three governance mirrors now resolve **0 broken links** (was 7 + 1 per the pre-fix state). The fix is in the transform, so future re-propagations stay correct (recurrence closed at the root).
