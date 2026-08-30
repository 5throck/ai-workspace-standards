---
title: Project Review Remediation Design
date: 2026-08-30
status: approved
author: architect
spec: REVIEW-REMEDIATION-2026-08-30
---

# Project Review Remediation Design

## Context

A project review (2026-08-30) identified eight categories of minor defects across
governance docs, CI workflows, variant contracts, and changelogs. This design doc
captures the verified findings and prescribes exact fixes. Most facts were verified
in the review session; two additional verifications (A and B) were performed by the
architect before finalizing.

---

## Verification Results

### Verification A — co-safety pm.md extends path

**Files inspected:**
- `templates/co-safety/agents/pm.md` (frontmatter + body)
- `templates/co-safety/variant.json`
- `templates/common/agents/pm.md` (confirmed exists, extends L0)
- `agents/pm.md` (L0 base)

**Finding:** co-safety pm.md currently has `extends: ../../../agents/pm.md`, which
resolves to the L0 root `agents/pm.md`, skipping the L1 common template.

**Decision: (a) Re-point extends to `../../common/agents/pm.md`.**

Rationale: The 3-level inheritance model (L0 -> L1 -> L2) requires L2 variants to
extend L1. L1 `templates/common/agents/pm.md` already extends L0, so the full chain
becomes L0 <- L1 <- L2. The `variant.json` already documents the pm override in
`agent_overrides` with type "additive" and reason — no additional documentation
needed there.

### Verification B — GEMINI.md heading format for cross-references

**Finding:** GEMINI.md uses `### 5. Agent Dispatch Rules` (line 177) and
`## Execution Plan Boilerplate` (line 188). CLAUDE.md uses the identical format.
Neither file uses `## §5` numbered-section notation — that convention is specific
to AGENTS.md.

**Implication:** The AGENTS.md cross-reference at line ~425 should cite the actual
heading names rather than the `§5` shorthand, since the target files don't use
that convention.

---

## Fix Specifications

### Fix 1 — co-safety pm.md extends path

**File:** `templates/co-safety/agents/pm.md`
**Edit:** Change `extends: ../../../agents/pm.md` -> `extends: ../../common/agents/pm.md`

### Fix 2 — PM phase references

**(a)** **File:** `AGENTS.md` line ~22
**Edit:** Change "lifecycle finalization (Phase 6)" -> "lifecycle finalization (Phase 5)"

**(b)** **File:** `docs/templates/common-contract.json` line ~20
**Edit:** Change `"orchestrates phases 0, 2, 6"` -> `"orchestrates phases 0, 1-2, 5"`

### Fix 3 — AGENTS.md stale cross-reference

**File:** `AGENTS.md` line ~425
**Current:** `See execution plan boilerplate in CLAUDE.md §5, GEMINI.md §5`
**Replacement:** `See execution plan boilerplate in CLAUDE.md and GEMINI.md "### 5. Agent Dispatch Rules" and "## Execution Plan Boilerplate"`

### Fix 4 — CHANGELOG.md duplicate headings

**File:** `CHANGELOG.md` under `[Unreleased]`
**Edit:** Merge four separate `### Fixed` headings (lines ~16, 19, 22, 31) into a single
`### Fixed` heading. Sort the individual entries by date (newest first). Keep all
entries; only collapse the heading duplication.

### Fix 5 — Korean source-material frontmatter

**File:** `docs/designs/2026-08-29-relation-graph-evolution-and-decision-chain-design.md`
**Edit:** Add YAML frontmatter fields:
```yaml
lang: ko
lang_reason: source-material
```
Justification: Korean i18n table at lines ~136-141 contains Korean regulatory
terms that are primary source material.

### Fix 6 — CI workflow hardening

**(a) .github/workflows/test.yml**
- Pin `bun-version` to `1.2.6` (latest stable; verify with `bun --version` on runner).
- Remove unused `node-version: [18.x]` matrix entry (no `setup-node` step exists).
- Add concurrency guard:
  ```yaml
  concurrency:
    group: ${{ github.workflow }}-${{ github.ref }}
    cancel-in-progress: true
  ```

**(b) .github/workflows/weekly-health-check.yml**
- Pin `bun-version` to `1.2.6` (same version for consistency).

### Fix 7 — variant-contract.json and PROMOTION_CHECKLIST

**(a)** **File:** `docs/templates/variant-contract.json`
**Edit:** Remove `CLAUDE.md` and `GEMINI.md` from the `required` array. Rationale:
commit `2d860f05` removed these files from all 13 variants by design — they rely on
the `templates/common` fallback.

**(b)** **File:** `docs/templates/PROMOTION_CHECKLIST-template.md` lines ~122-123
**Edit:** Remove or update the CLAUDE.md/GEMINI.md existence gate check to match
the contract change. The gate should no longer require these files at variant level.

### Fix 8 — templates/CHANGELOG.md version section

**File:** `templates/CHANGELOG.md`
**Edit:** Add a new `## [0.6.0] - 2026-08-28` section with:
- LICENSE rollout
- Skill promotions from co-safety and co-work (commit `70fef8bf`, 2026-08-28 —
  six skills promoted)
- Handbook + handbook-sync-audit promotion from co-deck (commit `1653a84f`,
  2026-08-30)

Rationale: VERSION is 0.6.0 since commit `a5714968` (2026-08-28). The changelog
must reflect this.

---

## Deferred Items

The following items were identified but are deferred to a future session:

| Item | Reason |
|------|--------|
| co-abap script drift | Requires dedicated investigation of scripts/ drift in templates/co-abap/ |
| variant.json betaEngagements enforcement | Policy decision needed on whether to enforce beta engagement tracking |
| agent_overrides enforcement in audit.ts | Requires audit script update + ADR — separate design doc |
| weekly-health-check notification config | Infrastructure decision — out of scope for this remediation |

---

## Verification Plan

After all fixes are applied, run:

```bash
bun scripts/audit.ts
```

**Pass criterion:** `audit.ts` must exit 0 with no hard failures. Warnings are
acceptable for deferred items if they are already present pre-fix.
