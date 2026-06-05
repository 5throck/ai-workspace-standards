# Meeting Transcript
**Date**: 2026-06-06
**Topic**: L0/L1/L2 Layer and Scope Classification Errors — Improvement Review
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background

PM pre-meeting investigation found three structural problems:
1. `helpers/*.ts` (17 files) classified as `Layer = common` in SCRIPTS.md → published to L1 → bulk-copied to L2 variants via B-01
2. Skills `create-variant`, `promote-variant`, `team-builder` have `scope: common` → published to L1 → bulk-copied to L2 variants
3. B-01 sync was a raw directory copy without the filtering logic of `create-l2-scaffold.ts`

---

## Transcript

### Round 1

**architect** (Round 1):
Identified root cause: Layer/scope classification defines "which layers upward" but not "how far downward." `helpers/*.ts` are internal dependencies of `l2-to-variant-pipeline.ts` (L0-only), so they should also be L0+L1 only. Proposed 3-tier Layer distinction: `L0` (root only), `L0+L1` (up to L1 template), `L0+L1+L2` (all layers including L2 projects). Asked automation-engineer whether any L2 project directly calls helpers/ scripts.

**automation-engineer** (Round 1):
Confirmed no L2 project calls `helpers/` directly — they are internal imports for workspace-level pipeline scripts. Agreed with `L0+L1` reclassification. Identified two code changes needed: (1) `create-l2-scaffold.ts` line 97 must also skip `L0+L1` scripts (not only `L0-only`), (2) raw directory copy must be replaced with filtered scaffold approach. Asked lifecycle-manager where SCRIPTS.md Layer column allowed values are formally defined.

**lifecycle-manager** (Round 1):
Confirmed Layer column allowed values are not formally defined anywhere — `publish-to-template.ts` code is the only de-facto definition (string includes `L0-only`). Noted that `common-contract.json` `common_scripts.layer_values` already documents `L0`, `L0+L1`, `L0+L1+L2` but actual SCRIPTS.md uses `L0-only`, `common`, `—` — document/data mismatch. Proposed unifying SCRIPTS.md Layer values to match `common-contract.json`. Asked architect if skill scope reclassification follows the same pattern.

**architect** (Round 1 supplement):
Confirmed skills follow the same pattern — `create-variant`, `promote-variant` are workspace operator tools, not L2 project user tools. Proposed skill scope extension: `scope: workspace` (L0 only, current), `scope: common` redefined as "L1 only" (operator-level), `scope: l2` new value for skills deployed to L2 projects. Or simpler: align skill scope with script Layer: `workspace` / `L0+L1` / `L0+L1+L2`. Asked auditor about impact on validate-templates.ts WS-03 and publish-to-template.ts filter logic.

**auditor** (Round 1):
Confirmed impact on two components: (1) `publish-to-template.ts` — current `scope === 'workspace'` check needs to handle new `L0+L1` values; (2) `validate-templates.ts` WS-03 — removing `create-variant`, `promote-variant` from `common_skills` requires removing from `common-contract.json` too, and WS-03 will no longer check for them. Advocated treating this as a Layer governance unification rather than a bug fix. Proposed adding a reverse-direction check to validate-templates.ts: if a variant contains scripts classified as `L0+L1`, report FAIL.

---

### Round 2

**automation-engineer** (Round 2):
Answered auditor's raw-copy prevention question: B-01 was a process failure — direct copy instead of using `create-l2-scaffold.ts`. Technical prevention: add reverse-direction check in `validate-templates.ts` (L0+L1 scripts in variant → FAIL). Listed 7 concrete fix tasks. Asked lifecycle-manager whether `lifecycle-sync-audit.ts` parses Layer column values (would be affected by rename).

**lifecycle-manager** (Round 2):
Confirmed `lifecycle-sync-audit.ts` does NOT parse Layer column — only checks @version sync. Layer value changes safe for this tool. Confirmed `publish-to-template.ts` Layer parsing must change from `includes('L0-only')` to `=== 'L0'`. Noted `common-contract.json` `layer_values` already uses the target values (`L0`, `L0+L1`, `L0+L1+L2`). Asked architect whether ADR is required.

**architect** (Round 2):
Confirmed ADR is required — Layer value unification is a governance policy decision ("what belongs in L2"), not a bug fix. ADR should define: 3-tier Layer definition, decision criterion (does L2 project user directly execute this?), skill scope to Layer mapping table. Skill scope changes (`workspace` reclassification) do NOT require ADR — existing `scope === 'workspace'` logic is reused. Root cause of initial misclassification: skills created without explicit scope defaulted to `common`. Proposed 5-step priority order.

**auditor** (Synthesis):
Synthesized all findings. One open item: `translate` skill scope — whether L2 projects need translation capability (architect to decide).

---

## Agreed Decisions

| Item | Decision |
|------|----------|
| Root cause | Layer/scope defines upward propagation but not downward distribution — structural gap |
| helpers/*.ts | Reclassify Layer: `common` → `L0+L1` (17 files). Remove from all 5 L2 variants. |
| create-variant, promote-variant, team-builder skills | Change `scope: common` → `scope: workspace`. Remove from common-contract.json common_skills. Remove from L2 variants. |
| Layer value unification | `L0-only` → `L0`, `common` → either `L0+L1` or `L0+L1+L2` per actual usage |
| Code changes | publish-to-template.ts: `includes('L0-only')` → `=== 'L0'`; create-l2-scaffold.ts: skip `L0+L1` |
| Reverse check | validate-templates.ts: FAIL if variant contains L0+L1 classified scripts |
| ADR | Required — architect leads Layer governance policy |

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| C-01 | architect | High | ADR — L0/L1/L2 Layer governance policy (criteria + mapping table) | L0-only | 1-2 |
| C-02 | automation-engineer | Low | SCRIPTS.md — reclassify `helpers/*.ts` Layer from `common` to `L0+L1` (17 files) | L0-only | 4 |
| C-03 | automation-engineer | Low | Skill scope fix — `create-variant`, `promote-variant`, `team-builder` → `scope: workspace` | L0-only | 4 |
| C-04 | automation-engineer | Low | `common-contract.json` — remove `create-variant`, `promote-variant`, `team-builder` from `common_skills` | L0-only | 4 |
| C-05 | automation-engineer | Low | `publish-to-template.ts` — unify Layer parsing: `includes('L0-only')` → `=== 'L0'` | L0-only | 4 |
| C-06 | automation-engineer | Low | `create-l2-scaffold.ts` — add `L0+L1` script exclusion logic | L0-only | 4 |
| C-07 | automation-engineer | Low | Remove from all 5 L2 variants: `skills/{create-variant,promote-variant,team-builder}/` + `scripts/helpers/` | L0-only | 4 |
| C-08 | automation-engineer | Low | `validate-templates.ts` — add reverse check: L0+L1 scripts in variant → FAIL | L0-only | 4 |

## Open Items

| # | Item | Owner |
|---|------|-------|
| O-01 | `translate` skill scope — does L2 project need translation capability? | architect |
