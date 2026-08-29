# Handbook Skills Common Promotion — Design

- **Spec ID**: 2026-08-30-handbook-common-promotion-design
- **Date**: 2026-08-30
- **Status**: implemented
- **Scope**: templates/common, templates/co-deck, scripts

## Problem

The handbook production capability (H-Stage pipeline) lived exclusively in the
`co-deck` variant: two skills (`handbook`, `handbook-sync-audit`), 21
TypeScript scripts under `scripts/co-deck/handbook/`, and their tests.
Handbook generation is not presentation-specific — any variant may need a
themed, searchable documentation site — so the capability belonged in the
common template (`templates/common/`), following the variant→common promotion
precedent (`k-kosis` from co-pitch; api-documentation/documentation-writing/
research-analysis from co-work/co-safety).

## Decision

Promote both skills and their entire supporting script/test suite to the
common template. Keep variant-defined agents where they are.

1. **Skills** → `templates/common/skills/handbook{,-sync-audit}/` with
   `scope: common`; `handbook-sync-audit` gains `l2_propagate: true`.
   co-deck-only wording (companion mode, agent dispatch) is generalized with
   explicit co-deck annotations.
2. **Scripts** → `templates/common/scripts/handbook/`. The common scripts
   directory is the canonical L1 script home (propagation-map `scripts`
   domain); a `handbook/` subfolder mirrors the existing `hooks/`, `helpers/`,
   `lib/` subfolder pattern. All path references (`scripts/co-deck/handbook/…`)
   become `scripts/handbook/…`.
3. **Tests** → `templates/common/scripts/tests/` (new subfolder, same pattern).
4. **Agents stay in co-deck** — ADR-0043 keeps specialist agents
   variant-defined. The promoted skills note that `handbook-writer` /
   `handbook-reviewer` are co-deck agents and name the generic fallback
   (docs-writer / PM specialist) for other variants.
5. **co-deck registration cleanup** — `variant.json` (skills list,
   `skill_manifest.variant_specific`, `script_manifest.local`,
   `handbook_pipeline.entry_skill`), `skills/SKILLS.md`,
   `scripts/co-deck/SCRIPTS.md`, `PROMOTION_CHECKLIST.md`, and the platform
   mirror copies (`.claude/`, `.gemini/`, `.agents/`) are pruned or repointed.
   Scaffolded co-deck projects resolve the skills via `inherits_common`.
6. **Registries** — `templates/common/skills/SKILLS.md` gains both rows;
   `docs/external-references.md` attribution path updated.

## Consequences

- All variants can invoke the handbook pipeline; co-deck behavior is
  unchanged in effect (skills resolve through the common inheritance chain).
- `scripts/co-deck/` retains only deck-pipeline scripts.
- Fork-model reconciliation for future L2/L3 projects classifies the common
  copies as canonical and prunes identical variant duplicates.

## Verification

- `bun test templates/common/scripts/tests/` — 26 pass / 0 fail
- `bun scripts/validate-skills.ts` / `validate-templates.ts` — 0 errors
- co-deck suite 181/182; the single failure
  (`theme-visual-regression` baseline comparison) reproduces on pristine HEAD
  and is unrelated to this promotion.
