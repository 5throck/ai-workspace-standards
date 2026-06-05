# Meeting Transcript
**Date**: 2026-06-06
**Topic**: Script Layer Classification Cleanup — common reclassification and L0-only leak audit
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background

PM pre-meeting investigation found:
1. ~40 scripts classified as `common` need reclassification into `L0+L1` vs `L0+L1+L2`
2. L0-only scripts (`create-l2-scaffold`, `dispatch-parallel`, `dispatch-serial`, `qa-gate`, `team-builder`) remain in co-develop, co-design, co-security, co-work (A-01 only fixed co-consult)
3. `propagate-to-templates.ts` found in co-develop but not registered in SCRIPTS.md

---

## Transcript

### Round 1

**auditor** (Round 1):
Proposed single classification criterion: "Is it needed for L2 project daily operation?" YES → `L0+L1+L2`, NO → `L0+L1`. Flagged `propagate-to-templates.ts` as immediate concern — unregistered script in L2 variant is an audit blind spot. Confirmed A-01 only covered co-consult, leaving 4 variants with L0-only script leaks. Asked architect to classify `generate-scripts-readme.ts`, `tag-template.ts`, `list-template-versions.ts`.

**architect** (Round 1):
Classified auditor's examples: `tag-template.ts` → `L0` (workspace-only), `generate-scripts-readme.ts` → `L0` (workspace-only), `list-template-versions.ts` → `L0+L1`. Provided bulk classification of all `common` scripts into three tiers. Asked automation-engineer whether L2 projects create further L2 projects (for `new-project.ps1/sh` classification).

**automation-engineer** (Round 1):
Confirmed no L2-creates-L2 scenario exists in current design → `new-project.ps1/sh` → `L0+L1`. Flagged `propagate-to-templates.ts` needs immediate content verification. Distinguished `dispatch.ts` (L0+L1+L2) from `dispatch-parallel/serial.ts` (L0-only). Asked lifecycle-manager about `upgrade-project.ps1/sh`.

**lifecycle-manager** (Round 1):
Classified `upgrade-project.ps1/sh` → `L0+L1+L2` (runs inside L2 project, upgrades project structure). Identified `propagate-to-templates.ts` likely as stale alias of `publish-to-template.ts` from pre-refactor era. Observed SCRIPTS.md currently has only 2 Layer values (`L0-only`, `common`) but 4 actual patterns exist. Asked auditor about `translate-readme.ts` and `analyze-git-history.ts`.

**auditor** (Round 1):
Classified `translate-readme.ts` → `L0+L1+L2` (L2 projects also have READMEs), `analyze-git-history.ts` → `L0+L1+L2`. Summarized Round 1 classification table.

---

### Round 2

**architect** (Round 2):
Proposed 3-question decision tree for Layer classification:
1. Does it directly manipulate `templates/` or `scripts/SCRIPTS.md`? → `L0` or `L0+L1`
2. Is it an internal dependency of an L0-only script? → `L0+L1`
3. Does it have meaning when executed inside an L2 project directory? → `L0+L1+L2`

Reclassified `sync-agent-status.ts`, `sync-skill-status.ts`, `sync-skills.ts` → `L0+L1+L2` (operate on agents/ and skills/ within any project). Classified `install-bun.ps1/sh` → `L0+L1+L2`. Confirmed decision tree will be included in ADR C-01.

**automation-engineer** (Round 2):
Confirmed sync-* scripts → `L0+L1+L2` per decision tree Q3. Proposed 4-step implementation plan: (1) immediate L0-only removals + propagate-to-templates.ts handling, (2) SCRIPTS.md Layer value corrections, (3) code changes to publish-to-template.ts and create-l2-scaffold.ts, (4) remove L0+L1 scripts from L2 variants and sync variant SCRIPTS.md files.

**lifecycle-manager** (Round 2):
Added warning: after removing L0+L1 scripts from L2 variants, their SCRIPTS.md files must also be updated or `verify-scripts.ts` will report errors. Classified `cleanup-completed-md.ps1/sh` → `L0+L1+L2`. Reiterated `propagate-to-templates.ts` needs content verification first.

**auditor** (Synthesis):
Synthesized all decisions. See Action Items below.

---

## Final Classification Decisions

| Change | Scripts | Final Layer |
|--------|---------|-------------|
| `L0-only` → `L0` (notation) | All existing L0-only scripts | `L0` |
| `common` → `L0` | `tag-template.ts`, `generate-scripts-readme.ts` | `L0` |
| `common` → `L0+L1` | `helpers/*.ts` (17), `generate-version-manifest.ts`, `list-template-versions.ts`, `skill-dependency-analysis.ts`, `test-new-project.ts`, `verify-new-project-tests.ts`, `verify-template-integrity.ts`, `new-project.ps1/sh` | `L0+L1` |
| `common` → `L0+L1+L2` (explicit) | All remaining `common` scripts | `L0+L1+L2` |

## Decision Tree (for ADR C-01)

```
Q1. Does it directly manipulate templates/ or scripts/SCRIPTS.md?
    → YES: L0 or L0+L1
Q2. Is it an internal dependency of an L0-only script?
    → YES: L0+L1
Q3. Does it have meaning when executed inside an L2 project directory?
    → YES: L0+L1+L2
```

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| D-01 | automation-engineer | Low | Verify `propagate-to-templates.ts` content — delete if duplicate of `publish-to-template.ts`, register in SCRIPTS.md if different | L0-only | 4 |
| D-02 | automation-engineer | Low | Remove L0-only scripts (5 files) from co-develop, co-design, co-security, co-work via git rm | L0-only | 4 |
| D-03 | automation-engineer | Low | SCRIPTS.md full Layer reclassification — `L0-only`→`L0`, `common`→`L0`/`L0+L1`/`L0+L1+L2` per decisions above | L0-only | 4 |
| D-04 | automation-engineer | Low | `publish-to-template.ts` — Layer parsing unification: `includes('L0-only')` → `=== 'L0'` | L0-only | 4 |
| D-05 | automation-engineer | Low | `create-l2-scaffold.ts` — add `L0+L1` exclusion logic; remove L0+L1 scripts from all 5 L2 variants; sync variant SCRIPTS.md files | L0-only | 4 |
| D-06 | automation-engineer | Low | `validate-templates.ts` — add reverse check: FAIL if variant contains `L0` or `L0+L1` classified scripts | L0-only | 4 |
| D-07 | architect | High | ADR — Layer governance policy with decision tree + skill scope mapping table | L0-only | 1-2 |

## Open Items

None — all items decided.
