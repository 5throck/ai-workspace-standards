# Meeting Transcript
**Date**: 2026-06-13
**Topic**: docs/ folder restructure — safe strategy for file moves/deletions with script references and document link integrity
**Participants**: architect, auditor, docs-writer, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**:
The core risks of this docs/ restructure fall into three categories. First, `docs/workspace-schema.json` is a SSOT hardcoded in three scripts (`audit.ts`, `validate-md-language.ts`, `validate-model-registry.ts`) — moving it would immediately break all three. Second, `docs/templates/lifecycle-governance.json` is the SSOT for `validate-templates.ts`, causing confusion with the newer `docs/governance/lifecycle-governance.json`. Third, `creating-a-variant.md` and `variant-creation-workflow.md` are referenced by different documents and cannot simply be deleted.

Proposed approach: clearly separate files that need to move from files that must stay put. Files like `workspace-schema.json` that scripts hardcode should remain in place — otherwise a file move triggers script changes which trigger more moves in a cascade. Question to automation-engineer: what is the patching cost for script path updates?

**automation-engineer**:
Agrees with architect's separation strategy. Concrete analysis of patching cost:

Files safe to move (no script references):
- `docs/l0-l1-differences.md` → `docs/architecture/`
- `docs/platform-parity-rules.md` → `docs/governance/`
- `docs/adr-0033-implementation-summary.md` → `docs/implementations/`
- `docs/decisions/0001-*.md` → `docs/adr/`
- `docs/migration/extends-pattern.md` → `docs/architecture/`

Files that must stay (script references, high risk to move):
- `docs/workspace-schema.json` — 3 scripts need patching
- `docs/templates/lifecycle-governance.json` — `validate-templates.ts` references it

Conclusion: keep script-referenced files in place; delete only `docs/templates/workspace-schema.json` (stale v1.0.0) to eliminate confusion. Question to docs-writer: what is the scale of broken document links?

**docs-writer**:
Supports automation-engineer's "keep script-referenced files in place" principle. Inbound link analysis:

- `docs/l0-l1-differences.md` — no inbound links (orphan) → safe to move
- `docs/platform-parity-rules.md` — no inbound links → safe to move
- `docs/adr-0033-implementation-summary.md` — no inbound links → safe to move
- `docs/decisions/0001-*.md` — no inbound links → safe to move to `docs/adr/`
- `docs/variant-creation-workflow.md` — **4 documents link to it** (ADR-0039, PROMOTION_CHECKLIST, QUALITY_GATES, variant-execution-plan-template) → moving requires 4 reference updates
- `docs/creating-a-variant.md` — **1 document links to it** (constitution/07-new-project.md)

Key proposal: rather than moving the two variant creation docs, clarify their roles. `variant-creation-workflow.md` = PM/governance workflow; `creating-a-variant.md` = developer how-to guide. Both can remain at docs/ root as top-level guides. Question to auditor: would a `_MISPLACED.md` marker approach add more confusion than it solves?

**auditor**:
Opposes `_MISPLACED.md` approach — meta-files increase audit complexity without guaranteeing actual cleanup.

Safe zone (no references, execute immediately — 6 items):
1. Move `docs/l0-l1-differences.md` → `docs/architecture/`
2. Move `docs/platform-parity-rules.md` → `docs/governance/`
3. Move `docs/adr-0033-implementation-summary.md` → `docs/implementations/`
4. Move `docs/decisions/0001-*.md` → `docs/adr/` (delete `docs/decisions/` folder)
5. Delete `docs/templates/workspace-schema.json` (v1.0.0 stale; scripts reference docs/ root version)
6. Delete `docs/governance/lifecycle-governance.json` (after merging to SSOT)

Hold zone (requires link updates, separate PR):
- `docs/migration/` folder (single file, verify links)
- `docs/implementations/` folder consolidation

Validation required: run `bun scripts/audit.ts` + `validate-docs-links` skill after each phase.

### Round 2

**architect**:
Auditor's safe/hold separation is the most actionable approach. One addition: before deleting `docs/governance/lifecycle-governance.json`, the role difference between the two files must be clarified. The governance version (v1.2.0) is newer and more complete, yet the templates version (v1.0.0) is the SSOT used by scripts — this is a reversed situation. Correct resolution: merge the governance version content INTO the templates version, then delete the governance version. This is a content-merge-then-delete, not a simple delete. automation-engineer should handle this alongside script reference verification.

**automation-engineer**:
Architect's lifecycle-governance merge point is accurate. Concrete 3-phase execution plan:

Phase 1 — Immediate (no script/link changes needed, 5 items):
- Move: `docs/l0-l1-differences.md` → `docs/architecture/`
- Move: `docs/platform-parity-rules.md` → `docs/governance/`
- Move: `docs/adr-0033-implementation-summary.md` → `docs/implementations/`
- Move: `docs/decisions/0001-*.md` → `docs/adr/` (delete `docs/decisions/`)
- Delete: `docs/templates/workspace-schema.json` (stale v1.0.0)

Phase 2 — Content merge then delete (1 item):
- Merge `docs/governance/lifecycle-governance.json` (v1.2.0) into `docs/templates/lifecycle-governance.json` (SSOT)
- Delete `docs/governance/lifecycle-governance.json`

Phase 3 — Deferred (separate PR):
- `docs/migration/` and `docs/implementations/` single-file folder consolidation
- `docs/creating-a-variant.md` vs `docs/variant-creation-workflow.md` role clarification

Validation: run `bun scripts/audit.ts` after each phase.

**docs-writer**:
Agrees with automation-engineer's 3-phase split. Phase 1 and 2 should be in one PR; Phase 3 tracked as a separate issue. Additional note: when moving `docs/decisions/0001-skill-resolution-priority.md` to `docs/adr/`, the filename must be renumbered to follow the ADR numbering convention. Current highest number is 0040, so `0041-skill-resolution-priority.md` is appropriate.

**auditor** (closing round):
All discussion has converged. The 3-phase plan with lifecycle-governance content merge, ADR renumbering, and validation gates is the correct approach. No further disagreement.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Medium | Phase 1: execute 5 moves/deletions + audit validation | L0-only | Immediate |
| A-02 | automation-engineer | Medium | Phase 2: merge lifecycle-governance.json content then delete governance/ version | L0-only | After A-01 |
| A-03 | docs-writer | Medium | Rename docs/decisions/0001-*.md → docs/adr/0041-skill-resolution-priority.md | L0-only | With A-01 |
| A-04 | docs-writer | Low | Phase 3: propose consolidation plan for migration/, implementations/ folders | L0-only | Separate PR |
| A-05 | architect | Low | Clarify roles of creating-a-variant.md vs variant-creation-workflow.md | L0-only | Separate PR |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | All moved files exist at new paths | `ls` check |
| 2 | No script references broken | `bun scripts/audit.ts` passes |
| 3 | lifecycle-governance.json SSOT updated to v1.2.0 content | File diff check |
| 4 | docs/decisions/ folder removed | `ls docs/decisions` fails |
| 5 | validate-docs-links passes | skill execution |

---

# Follow-up Meeting: Unresolved Items
**Date**: 2026-06-13
**Topic**: docs/ unresolved items — single-file folder consolidation and creating-a-variant.md vs variant-creation-workflow.md role clarification
**Status**: Complete

## Resolution

### Single-file folder consolidation
- `docs/migration/extends-pattern.md` → `docs/architecture/` (delete migration/ folder)
- `docs/implementations/mvp-wave-1-summary.md` → `docs/designs/` (delete implementations/ folder)
- Both files have no inbound links — safe to move

### creating-a-variant.md vs variant-creation-workflow.md
- Both files remain at docs/ root — accessibility is intentional
- No merge or move — add cross-reference header to each file
- Current reference relationships already correctly aligned

## Final Action Items (merged into Phase 1+2 PR)

| # | Owner | Tier | Deliverable | Platform |
|---|-------|------|-------------|----------|
| A-01 | automation-engineer | Medium | 5 moves/deletions (Phase 1 items) | L0-only |
| A-02 | automation-engineer | Medium | lifecycle-governance.json merge + delete governance/ version | L0-only |
| A-03 | docs-writer | Medium | migration/→architecture/, implementations/→designs/, delete empty folders | L0-only |
| A-04 | docs-writer | Low | Add cross-reference headers to both variant creation docs | L0-only |
| A-05 | auditor | Medium | Post-cleanup audit.ts + validate-docs-links validation | L0-only |
