# sound-synth Orphan Mirror Cleanup Design (co-game Scaffold Delivery-Parity Fix)

- **Date**: 2026-09-28
- **Status**: Implemented (2026-09-28 — stale mirror copies removed; nightly Scaffold E2E co-game failure fixed)
- **Owner**: Automation Engineer
- **Spec id**: `2026-09-28-sound-synth-orphan-mirror-cleanup-design` (registry: `docs/specs/registry.json`, source: `manual`)
- **Related ADRs**: ADR-0074 (Universal Design Gate)
- **Symptom ticket**: Nightly Scaffold E2E (all variants) run `36301486247` (2026-09-27): 12/13 variants passed, co-game FAILED

---

## 1. Summary

Remove the five stale `sound-synth` platform-mirror copies under `templates/common/.{claude,gemini,agents,codex,hermes}/skills/sound-synth/`, and drop the now-unneeded `sound-synth` entry from `common-contract.json` → `common_platform_skill_exclusions`. `sound-synth` is a **co-game variant-scoped skill** whose SSOT is `templates/co-game/skills/sound-synth/SKILL.md` (declared in `variant.json`, tracked in `workspace-schema.json` → `variant_scoped_skills`, absent from the root `skills/` SSOT). The common-mirror copies were leftovers that diverged from the variant SSOT — different `l2_propagate` value (`false` vs the SSOT's `true`) and a diverged body (last touched by the variant-scope-prune hygiene commit while the SSOT later moved through two modernization commits).

## 2. Failure mechanics (why the nightly failed)

The nightly E2E co-game run failed at Test 26 (delivery derivation vs actual scaffold, `T-20260915-003`):

```
Test 26: delivery derivation drifted from actual scaffold (5 path(s)):
  scaffolded but not derived: .{agents,claude,codex,gemini,hermes}/skills/sound-synth/SKILL.md
```

Chain of causes:

1. `deriveNewProjectDelivery` walks **only** `templates/common` and excludes mirror skills whose copy carries `l2_propagate: false` (`collectL2PropagateFalseSkills`) — the stale copies said `false`, so the derivation dropped those five relpaths.
2. The scaffold ALSO excludes them (the `l2_propagate: false` sweep, logging `🗑️ Excluded L1-only skill`) — but for co-game the variant overlay re-delivers the skill from `skills/` (SSOT copy, `l2_propagate: true`) and the platform-mirror sync re-mirrors it into all five mirrors **after** the sweep.
3. Final tree: the five mirror paths exist (variant content). Derivation: they are excluded. → `scaffolded but not derived` → Test 26 fails.

Every OTHER variant's scaffold passed because both sides excluded the phantom paths; co-game is the only variant whose overlay legitimately re-delivers the skill — which is exactly why only co-game caught the drift.

## 3. Decisions

- **D1 — Delete the orphan copies (the fix)**: variant-scoped skills must not exist in the `templates/common` platform mirrors; their only legitimate homes are `templates/co-game/skills/` (SSOT) and, post-scaffold, the project's own mirrors (re-mirrored from the project's `skills/`). After deletion the derivation universe no longer contains the paths; both sides of the Test 26 comparison drop them; co-game's real delivery (from the variant overlay) stays outside the common universe — out of scope for this comparison by design.
- **D2 — Drop the contract exclusion**: `common_platform_skill_exclusions.sound-synth` existed to whitelist the leaked mirror dirs from the full-inventory ruling; with the dirs gone the stale-exclusion anti-drift check (`validate-templates.ts`) demands its removal. The `workspace-schema.json` `variant_scoped_skills` entry stays — the skill remains variant-scoped and schema-exempt for inventory purposes.
- **D3 — No schema/skill version changes**: no root-level skill or registry rows are touched (sound-synth has none at L0).

## 4. Verification

- `bun scripts/test-new-project.ts <name> --variant co-game --yes` → exit 0, Test 26 PASSED, ALL PASSED; the `Excluded L1-only skill … sound-synth` sweep lines no longer appear.
- Regression: `--variant co-develop` (the PR-CI default variant) → ALL PASSED.
- `bun test tests/unit/` → 1304 tests, 0 fail (incl. the C-CM-04 exclusion-pin updated to the five-entry list).
- `bun scripts/validate-templates.ts` → 0 errors (the stale-exclusion FAIL gone).
- Stability: root mirrors (`.{claude,gemini,agents,codex,hermes}/skills/` at the workspace root) do not contain sound-synth, so the L0→L1 publish/cascade re-publish cannot re-seed the deleted copies.

## 5. Scope notes

- Existing L2 projects are unaffected: only the co-game project has sound-synth mirrors, and its copies are the true variant content (`l2_propagate: true`); no other project ever received the stale copies. No fleet upgrade is needed.
- Blind-spot note: `validate-templates.ts` Check B-11 ("variant_scoped_skills must not leak into `templates/common/skills/`") inspects only the canonical `skills/` tree — the platform mirrors were outside its scan, which is how the orphans survived. Widening B-11 to the mirrors is a possible follow-up, not done here.
