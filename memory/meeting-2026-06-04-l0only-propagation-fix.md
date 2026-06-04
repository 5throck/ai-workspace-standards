# Meeting Transcript
**Date**: 2026-06-04
**Topic**: L0-only helpers copied to L1 — dual SSOT mismatch between propagation-map.json and SCRIPTS.md
**Participants**: architect, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background (Pre-meeting findings)

- `publish-to-template.ts` L0→L1 direct copy (line 97): reads SCRIPTS.md layer column, skips L0-only ✅
- `publish-to-template.ts` L1→L2 propagation: reads `propagation-map.json` exclude list only ❌
- 7 L0-only helpers in SCRIPTS.md but NOT in propagation-map.json exclude list:
  `beta-lifecycle.ts`, `generate-variant.ts`, `validate-platform-parity.ts`,
  `integration-helpers.ts`, `reconcile-with-l0-l1.ts`, `scan-l2-project.ts`, `variant-governance-rules.ts`
- `lib/` folder: no domain in propagation-map.json at all
- `helpers/template-validation.ts`: layer=common in SCRIPTS.md but in exclude list in propagation-map.json (inconsistency)

---

## Transcript

**[Architect]** (Round 1)

Core diagnosis confirmed: this is a design defect — L0-only classification criteria split across two files. SCRIPTS.md holds intent; propagation-map.json holds behavior. These represent the same concept in different places.

Two solution paths: (A) Make propagation-map.json the SSOT; (B) Make SCRIPTS.md layer column the sole SSOT and change publish-to-template.ts to read it instead of propagation-map.json exclude list.

Recommend option B. SCRIPTS.md already manages all script metadata; the layer column carries explicit design intent. The propagation-map.json exclude list is derived information being maintained manually — this is the root cause. If L1→L2 propagation also reads SCRIPTS.md layer, exclude lists become unnecessary.

Question to automation-engineer: in publish-to-template.ts, beyond the exclude list, what other information does propagation-map.json provide to L1→L2 propagation? Can it be fully removed?

**[Automation-Engineer]** (Round 1)

Agree with option B. Analysis: propagation-map.json provides three pieces of non-replaceable info: (1) source directory, (2) target directory, (3) include pattern. Only the exclude list can be replaced by SCRIPTS.md. Complete removal is not feasible.

Proposed concrete fix: remove `exclude` fields from propagation-map.json domains; in `collectDiffs()` function, before adding each file to diffs, look up SCRIPTS.md registry and skip if `layer.includes('L0-only')`. Implementation: ~10 lines in collectDiffs(), SCRIPTS.md parsed once at function start into a map.

No temporary fix needed — 7 files not currently in L1 so no immediate risk. Applying temp fix would entrench the dual-SSOT problem further.

Question to architect: add `scripts-lib` domain to propagation-map.json for explicit declaration? Also, `template-validation.ts` appears in both common layer (SCRIPTS.md) and exclude list (propagation-map.json) — intentional exception?

**[Architect]** (Round 2)

Agreed on `scripts-lib` domain addition. Explicit declaration improves readability and future-proofs lib/ for when common files are added there.

Decision confirmed: no temporary fix, proceed directly to root fix.

On `template-validation.ts`: SCRIPTS.md says `common`, file exists in L1, but propagation-map.json excludes it from L1→L2 propagation. This is a data inconsistency requiring clarification. If `common`, remove from exclude and let SCRIPTS.md-based filter handle it. If actually L0-only, fix SCRIPTS.md.

Final design decisions:
1. propagation-map.json: remove all `exclude` fields, add `scripts-lib` domain, update notes
2. publish-to-template.ts: add SCRIPTS.md layer lookup in collectDiffs(), version 1.3.5 → 1.3.6
3. lib/error-handling.ts, lib/pipeline-state.ts: add missing @version 1.1.0 headers
4. helpers/template-validation.ts: resolve layer inconsistency

**[Automation-Engineer]** (Round 2)

Confirmed on scripts-lib domain. Final work list:
1. Fix @version headers in lib/ (2 files)
2. Clarify template-validation.ts layer intent
3. Remove all exclude fields from propagation-map.json, add scripts-lib domain
4. Add SCRIPTS.md layer-based L0-only filter to collectDiffs() in publish-to-template.ts

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | automation-engineer | Low | Add `@version 1.1.0` to `lib/error-handling.ts` and `lib/pipeline-state.ts` | Immediate |
| A-02 | architect | Low | Clarify `helpers/template-validation.ts` layer intent — fix SCRIPTS.md or L1 accordingly | Immediate |
| A-03 | automation-engineer | Medium | `propagation-map.json`: remove all `exclude` fields, add `scripts-lib` domain, update notes | Phase 1 |
| A-04 | automation-engineer | Medium | `publish-to-template.ts`: add SCRIPTS.md layer-based L0-only filter in `collectDiffs()`, bump to 1.3.6 | Phase 1 |
| A-05 | automation-engineer | Low | Update SCRIPTS.md versions and sync to L1 | Phase 2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | L0-only helpers are never copied to L1 even when they exist in scripts/helpers/ | Run `bun run publish-to-template` after placing a test L0-only .ts in helpers/, confirm it is not copied |
| C-02 | propagation-map.json has no `exclude` fields | grep exclude propagation-map.json = no results |
| C-03 | `bun scripts/lifecycle-sync-audit.ts` passes | Run audit |
| C-04 | lib/error-handling.ts and lib/pipeline-state.ts have @version headers | grep @version scripts/lib/*.ts |

---

## Follow-up Meeting: template-validation.ts layer clarification

**Date**: 2026-06-04 (same session)
**Status**: Complete

### Finding
`helpers/template-validation.ts` hardcodes `templates/common/` and `templates/<variant>/` paths relative to workspace root. L2 projects have no `templates/` directory — script would fail if run there. No script imports it. Found only in co-consult (accidental copy) among L2 variants.

**Verdict: L0-only** (wrongly registered as `common` in SCRIPTS.md)

### Root cause of incorrect registration
The file was placed in L1 intentionally ("should be in L1 but not propagated to L2") and excluded in propagation-map.json as a workaround. The `common` layer tag was incorrect — it should have been `L0-only`.

### Additional open item
`helpers/lifecycle-governance.ts` — same potential issue, needs separate verification.

### Action Items (Amendment)

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-02a | automation-engineer | Low | SCRIPTS.md: helpers/template-validation.ts layer common → L0-only |
| A-02b | automation-engineer | Low | Delete templates/common/scripts/helpers/template-validation.ts |
| A-02c | automation-engineer | Low | Delete templates/co-consult/scripts/helpers/template-validation.ts |
| A-02d | architect | Low | Verify helpers/lifecycle-governance.ts usage — L0-only vs common |
