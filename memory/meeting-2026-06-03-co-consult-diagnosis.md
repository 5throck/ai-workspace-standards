# Meeting Transcript
**Date**: 2026-06-03
**Topic**: co-consult Variant Diagnosis and Workspace Integration Plan
**Participants**: architect, pm
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[architect]**: (Round 1)

After analyzing the full structure of `c:\demo\co-consult`, a critical finding emerged: this folder is a **fully completed co-consult variant** but its **identity is still bound to co-work**. Specifically:

**3 Identified Mismatches:**
1. `variant.json` has `name: "co-work"` and co-work description. `agent_overrides.pm.reason` also reads "co-work provides..."
2. `variant.json` `skill_manifest` references `research-analysis`, `documentation-writing`, `api-documentation` — all co-work skills. The 22 actual consulting skills (`competitive-intelligence`, `financial-modeling`, `consulting-report-writing`, etc.) are not registered.
3. `AGENTS.md` header reads "Co-Work Variant" and Phase names don't match consulting — Phase 3 "Content Creation", Phase 4 "Platform Delivery" are co-work terminology.

**Agent and skill quality is excellent.** All 11 agents and 22 skills are well-designed for the strategy consulting domain. The 7-phase workflow is appropriate. The actual work needed is not building a new variant but **replacing co-work identity with co-consult through renaming and alignment**.

PM, do you agree with this analysis? And confirmation is needed: is the goal to move this demo folder to `templates/co-consult` for workspace integration?

---

**[pm]**: (Round 1)

Architect's diagnosis is accurate. This is a **rectification task**, not a new build — that distinction significantly reduces the execution plan scope.

Clarifying the integration goal: integrate `c:\demo\co-consult` into `c:\git\templates\co-consult`, correcting all remaining co-work identity artifacts to co-consult.

Correction scope classification:

**Group A — Identity Correction (mandatory, immediate):**
- `variant.json`: full replacement of `name`, `description`, `agent_overrides.pm.reason`, `skill_manifest`
- `AGENTS.md`: header "Co-Work Variant" → "Co-Consult Variant", phase names replaced with consulting terminology
- Phase 3 "Content Creation" → "Deliverable Creation", Phase 4 "Platform Delivery" → "Implementation & Delivery"

**Group B — Skill Manifest Rebuild (mandatory):**
All 22 skills must be registered in `variant.json` `skill_manifest.variant_specific`. Currently only 3 co-work skills are registered.

**Group C — Verification (post-execution):**
- `bun scripts/audit.ts` pass
- `bun run agent:verify` pass

**Critical question**: `agents/_COMMON.md` exists. This file is not present in other variants. If it contains shared baseline behavior rules for all agents, its handling must be decided before proceeding.

---

**[architect]**: (Round 2)

The `_COMMON.md` file PM raised is important. No other variant's `agents/` directory has this file. If it contains shared baseline behavior rules, two options exist: (1) retain as co-consult-specific common guidelines, (2) move to `templates/common/agents/` for workspace-wide contribution. Deletion or movement must be deferred until content is confirmed.

**Integration Execution Plan — Final:**

| Step | Task | Target Files | Owner |
|------|------|--------------|-------|
| 1 | Review `_COMMON.md` content and decide handling | `agents/_COMMON.md` | architect → user approval |
| 2 | Correct `variant.json` co-consult identity | `variant.json` | automation-engineer |
| 3 | Correct `AGENTS.md` header + Phase names | `AGENTS.md` | automation-engineer |
| 4 | Register 22 skills in `skill_manifest` | `variant.json` | automation-engineer |
| 5 | Copy/move demo → `templates/co-consult` | entire folder | scaffolding-expert |
| 6 | Update templates root README/index | `templates/README.md` | docs-writer |
| 7 | Full audit pass verification | — | auditor |

PM, is it appropriate to formalize through team-builder skill Step 5 Approval Gate via proposal JSON? Or since files already exist, should we proceed directly with the correction plan?

---

**[pm]**: (Round 2)

Good question. team-builder skill Step 5 is designed for new creation scenarios. Since files already exist and correction scope is clear, proceeding with a **direct correction plan (with PM approval gate)** is more efficient than the proposal JSON path.

**Final Agreements:**
1. This is a correction + integration task, not new construction
2. Agent/skill quality is preserved — no content changes
3. Correction targets: `variant.json` identity, `AGENTS.md` header/phase names, `skill_manifest` 22 skills
4. `_COMMON.md` handling deferred until content confirmed and user approves
5. Execution order: correct → copy → audit pass

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | architect | High | Review `agents/_COMMON.md` content, propose handling (retain/move/merge) | Pre-execution |
| A-02 | automation-engineer | Medium | Correct `variant.json`: name, description, agent_overrides, skill_manifest (22 skills) | Execution |
| A-03 | automation-engineer | Medium | Correct `AGENTS.md`: header + Phase 3/4 names | Execution |
| A-04 | scaffolding-expert | Medium | Copy `c:\demo\co-consult` → `c:\git\templates\co-consult` | Execution |
| A-05 | docs-writer | Medium | Update `templates/README.md` to include co-consult entry | Execution |
| A-06 | auditor | Medium | Run `bun scripts/audit.ts` and `bun run agent:verify`, confirm pass | Verification |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | `variant.json` name = "co-consult", co-consult description | File content check |
| 2 | All 22 skills registered in skill_manifest | variant.json skill_manifest count |
| 3 | AGENTS.md header = "Co-Consult Variant" | File content check |
| 4 | `templates/co-consult/` exists in workspace | `ls templates/co-consult` |
| 5 | `bun scripts/audit.ts` exits 0 | Audit output |
| 6 | `bun run agent:verify` exits 0 | Verify output |
