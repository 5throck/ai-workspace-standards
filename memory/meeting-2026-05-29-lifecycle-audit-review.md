# Meeting Transcript
**Date**: 2026-05-29
**Topic**: Lifecycle governance comprehensive audit — 7 issues review and remediation plan
**Participants**: pm, architect, automation-engineer, auditor
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Pre-Meeting Findings (7 Issues)

| # | Issue | Severity |
|---|-------|----------|
| 1 | Workspace root agents (7): `status` field MISSING | High |
| 2 | Workspace root skills (4): `status` field MISSING | High |
| 3 | `agent-lifecycle-manager` SKILL.md: status value is description text, not a valid value | High |
| 4 | co-work/co-design agents (all): `status` field MISSING | High |
| 5 | co-develop/co-work/co-design: no `skills/` directory (VARIANT_CONTRACT violation) | Medium |
| 6 | `lifecycle-governance.json` orchestrator references deprecated `audit.sh` | Low |
| 7 | SCRIPTS.md `pair` field not implemented (decided in previous meeting) | Medium |

---

## Transcript

**PM**: (Opening)

Called to review 7 lifecycle issues found during comprehensive audit. Round 1 covers data quality issues (issues 1-4, frontmatter status gaps). Round 2 covers structural/policy issues (issues 5-7).

Question to auditor: Are the status field gaps being detected by current audit tools, or are they silently passing?

---

**Auditor**: (Round 1)

**Silently passing.** `audit.ts` outputs `[PASS] Agent audit: all agents healthy` despite all 7 workspace root agents missing the `status` field. `agent-lifecycle-audit.ts` does not include `status` in the required frontmatter fields — it only checks `name`, `tier`, `description`, `examples`. Same for `skill-lifecycle-audit.ts`.

The `agent-lifecycle-manager` SKILL.md oops is worse: `status: active | draft | deprecated | archived` is description text, not a value. Any tool parsing this would fail to recognize a valid status.

Both audit tools also don't include status in `validate-templates.ts` checkAgents(). Co-work and co-design agents are all missing status yet validate-templates passes.

Summary: all three issue types (missing, miswritten, blank) silently pass all audit tools.

Question to architect: Should `status` be elevated to required frontmatter for agents and skills, with enum validation?

---

**Architect**: (Round 1)

Yes — `status` must be required frontmatter. The `status` field is the core data point of the lifecycle system. Without knowing whether an agent or skill is active or deprecated, automated tools cannot make correct decisions. This is an operational data completeness issue, not merely a documentation gap.

Enum validation should be added: agents → `active | deprecated | experimental`, skills → `active | deprecated | experimental | archived`.

Design question: Do workspace root `agents/` and template variant `agents/` use the same status enum? `validate-templates.ts` already checks variant agent frontmatter but may not check status. If the two locations have different validation rules, consistency breaks.

Question to automation-engineer: Which files currently validate frontmatter and where is status validation absent?

---

**Automation-Engineer**: (Round 1)

`validate-templates.ts` `checkAgents()` checks frontmatter fields: `['name', 'tier', 'description', 'examples']`. Status is NOT included. No enum validation exists.

`agent-lifecycle-audit.ts` (workspace root): same — status not in required fields.

Both tools skip status. This is why all missing-status agents pass silently.

Three files need modification:
1. `scripts/agent-lifecycle-audit.ts` — add `status` to required frontmatter, add enum validation
2. `scripts/skill-lifecycle-audit.ts` — same
3. `scripts/validate-templates.ts` `checkAgents()` — same

Critical: file fixes must happen before tool strengthening. Strengthening tools first will immediately break audit.

---

**PM**: (Round 1 — Close)

Decisions: status elevated to required frontmatter (unanimous). Enum validation added to all three audit tools. File fixes before tool strengthening (mandatory sequence).

Issues 1-4 remediation:
- Issues 1, 4: Add `status: active` to workspace root agents (7) and co-work/co-design agents (all)
- Issue 2: Add `status: active` to 4 workspace root skills
- Issue 3: Fix agent-lifecycle-manager SKILL.md: `active | draft | deprecated | archived` → `active`

Round 2: Question to architect — is the absence of `skills/` in co-develop/co-work/co-design a VARIANT_CONTRACT violation or intentional design?

---

**Architect**: (Round 2)

VARIANT_CONTRACT violation. VARIANT_CONTRACT.md requires `skills/agent-lifecycle-manager/SKILL.md` as a mandatory file. Current state: co-security has 4 skills, co-develop/co-work/co-design have no `skills/` directory.

`validate-templates.ts` `checkVariantSkills()` uses presence-driven approach: if no `skills/` directory → `"not present (OK)"` → PASS. This was an intentional design decision, but it creates a conflict with VARIANT_CONTRACT.md.

Two options: (A) Add `skills/` + minimum skills to 3 variants — recommended, because without `agent-lifecycle-manager` the variant cannot be lifecycle-managed; (B) Remove skills from VARIANT_CONTRACT required list — not recommended, degrades governance.

Option A is correct. The question is which skills to include — use co-security's configuration as the standard baseline.

Question to automation-engineer: Issues 6 and 7?

---

**Automation-Engineer**: (Round 2)

Issue 6 — `lifecycle-governance.json` orchestrator: `workspace-root.orchestrator` says `"scripts/audit.sh"` but `audit.sh` is now a deprecated thin wrapper. SSOT is `audit.ts`. Simple fix: change to `"scripts/audit.ts"`. Also `l2-projects.orchestrator` says `"scripts/audit.sh (project copy)"` — needs same fix.

Issue 7 — SCRIPTS.md pair field: decided in `meeting-2026-05-28-script-pair-sync.md` but not implemented. Requires: (A) Add `pair` column to SCRIPTS.md for 6 pairs, (B) Add pair version sync + section header comparison logic to `verify-scripts.ts`. Feasible short-term but priority should be set carefully given ongoing Tier 2 transition.

Question to auditor: How do you prioritize the 7 issues — immediate vs. next phase?

---

**Auditor**: (Round 2)

**Immediate** (audit integrity):
- Issues 1, 4: agent status fields (workspace root + co-work/co-design) — files first, tool strengthening second
- Issue 2: workspace root skill status fields
- Issue 3: agent-lifecycle-manager SKILL.md value fix
- Issue 6: governance.json orchestrator update (1-line fix)

**Next phase** (structural design required):
- Issue 5: skills/ directories for 3 variants — need decision on standard skill composition before implementation
- Issue 7: SCRIPTS.md pair field — technical debt, no immediate operational impact

Critical sequence constraint: C-01 through C-03 (file fixes) must complete before C-04 (tool strengthening). Reverse order breaks audit immediately.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| C-01 | automation-engineer | Add `status: active` to workspace root agents (7 files: architect, auditor, automation-engineer, docs-writer, pm, scaffolding-expert, security-expert) | Immediate — files first |
| C-02 | automation-engineer | Add `status: active` to workspace root skills (4 files: meeting-facilitation, script-lifecycle-manager, skill-lifecycle-manager, ui-ux-pro-max) + fix agent-lifecycle-manager oops (`active \| draft...` → `active`) | Immediate — files first |
| C-03 | automation-engineer | Add `status: active` to all co-work and co-design agent files | Immediate — files first |
| C-04 | automation-engineer | Strengthen `agent-lifecycle-audit.ts`, `skill-lifecycle-audit.ts`, `validate-templates.ts` checkAgents(): add `status` to required fields + enum validation | Immediate — after C-01~C-03 |
| C-05 | automation-engineer | Update `lifecycle-governance.json`: workspace-root.orchestrator and l2-projects.orchestrator `audit.sh` → `audit.ts` | Immediate |
| C-06 | architect | Decide standard skill composition for co-develop/co-work/co-design, then add `skills/` directories and minimum required skills | Next phase |
| C-07 | automation-engineer | Implement `pair` column in SCRIPTS.md + pair validation logic in `verify-scripts.ts` | Next phase |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `bun scripts/agent-lifecycle-audit.ts` reports 0 errors, 0 warnings for all agents | Run audit and check output |
| AC-02 | `bun scripts/skill-lifecycle-audit.ts` reports 0 errors, 0 warnings for all skills | Run audit and check output |
| AC-03 | `bun scripts/validate-templates.ts` detects missing status as error (not silent pass) | Test with a variant agent missing status |
| AC-04 | `lifecycle-governance.json` orchestrator fields reference `audit.ts` | Manual file inspection |
| AC-05 | All agent files have `status: active` or valid enum value | `grep -r "^status:" agents/ templates/*/agents/` |
