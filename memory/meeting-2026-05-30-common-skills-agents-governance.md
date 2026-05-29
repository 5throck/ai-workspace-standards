# Meeting Transcript
**Date**: 2026-05-30
**Topic**: Common Skills & Agents Central Management — templates/common Governance Advancement
**Participants**: PM, Architect, Lifecycle Manager, Scaffolding Expert
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

1. Round 1: Diagnose current duplication problem and design the L1 (common) layer for skills and agents
2. Round 2: Migration plan and validation automation

---

## Round 1: Problem Diagnosis and Architecture Design

**PM**: (Round 1 — Open)

As variants grow, maintaining separate copies of common skills and agents in each variant directory becomes unmanageable. Architect, propose the L0/L1/L2 extension model. Lifecycle Manager, advise on sync mechanics.

---

**Architect**: (Round 1)

Current problem: the L0→L1→L2 layering that works well for scripts is not applied to skills and agents. The `project-review` skill was just deployed to 5 separate locations — this will multiply with each new variant.

Proposed extension of the L0/L1/L2 model:

**Skills:**
- L0: `skills/` — workspace-root SSOT (unchanged)
- L1: `templates/common/skills/` — NEW: shared skills for all variants
- L2: `templates/co-xxx/skills/` — variant-specific skills only

**Agents:**
- L0: `agents/` — workspace-root agents (unchanged)
- L1: `templates/common/agents/` — NEW: shared agents (pm, lifecycle-manager)
- L2: `templates/co-xxx/agents/` — variant-specific agents only

The `new-project.sh` copy-then-overlay mechanism already supports this: common/ is applied first, then variant/ overlays on top. Common agents and skills automatically reach all projects without per-variant duplication.

---

**Lifecycle Manager**: (Round 1)

Sync strategy for the new L1 layer:

For skills: extend `publish-to-template.ts` to include a skills sync step: workspace L0 `skills/` → L1 `templates/common/skills/` for designated common skills.

For agents: create a new `sync-common-agents.ts` script that copies designated common agents (pm.md, lifecycle-manager.md) from L0 `agents/` to L1 `templates/common/agents/`.

Classification criteria:
- Common skill = used identically across all variants (project-review, meeting-facilitation, audit-workspace, security-scan, skill-lifecycle-manager, agent-lifecycle-manager)
- Variant-specific skill = contains variant-domain content (ui-ux-pro-max for co-design, code-review for co-develop, etc.)
- Common agent = exists in all 4 variants with identical or near-identical content (pm, lifecycle-manager)
- Variant-specific agent = domain expert unique to one variant (design-lead, code-writer, red-team-lead, etc.)

---

**PM**: (Round 1 — Close)

Architecture agreed: extend L0/L1/L2 to skills and agents. Common layer at templates/common/. Sync via publish-to-template.ts (skills) and new sync-common-agents.ts (agents). Classification criteria established.

---

## Round 2: Migration Plan and Validation

**PM**: (Round 2 — Open)

Scaffolding Expert, define the migration phases and risk areas. Architect, specify what validate-templates.ts should enforce for the new governance model.

---

**Scaffolding Expert**: (Round 2)

Migration phases:

**Phase 1 (Immediate)**: Formalize templates/common/skills/
- `project-review` already there — keep it as the pilot
- Move 5 additional common skills: meeting-facilitation, audit-workspace, security-scan, skill-lifecycle-manager, agent-lifecycle-manager
- After moving to common, delete per-variant copies from co-xxx/skills/
- Add skills sync to publish-to-template.ts
- Risk: validate-templates.ts B-05 check counts per-variant skills; after deletion those counts drop. Must update the expected minimum.

**Phase 2 (1 week)**: Create templates/common/agents/
- Before moving, diff each variant's pm.md against workspace-root agents/pm.md to identify variant-specific customizations
- If variant pm.md is identical to common → delete variant copy (common takes over)
- If variant pm.md has customizations (e.g., co-security's PM has authorization gates) → keep variant copy as intentional override
- Same analysis for lifecycle-manager.md
- Important: common/agents/ does NOT need README.md/README_ko.md — those are variant-contract requirements for variant agent directories, not the common layer

**Phase 3 (2 weeks)**: Validation automation
- Add validate-templates.ts check: if a skill in co-xxx/skills/ is identical to common/skills/, warn (should be in common, not duplicated)
- Add check: if co-xxx/agents/pm.md exists AND differs from common/agents/pm.md, require an explicit `override: true` frontmatter field to confirm it's intentional

---

**Architect**: (Round 2)

validate-templates.ts enforcement rules for the new model:

| Check | Severity | Description |
|-------|----------|-------------|
| C-SK-01 | WARNING | Skill exists in co-xxx/skills/ and is identical to common/skills/ — should be removed from variant |
| C-AG-01 | WARNING | Agent in co-xxx/agents/ is identical to common/agents/ — should be removed from variant |
| C-AG-02 | INFO | Agent in co-xxx/agents/ differs from common/agents/ — requires `override: true` in frontmatter |
| C-CM-01 | ERROR | common/skills/ contains a skill not in L0 skills/ — source of truth violation |
| C-CM-02 | ERROR | common/agents/ contains an agent not in L0 agents/ — source of truth violation |

These checks create a closed loop: common must match L0, variants must not duplicate common.

---

**PM**: (Round 2 — Close)

Migration plan in three phases, validation in five new checks. The key insight from Scaffolding Expert: variant pm.md customizations (especially co-security's authorization gates) must be preserved as intentional overrides, not blindly replaced.

Open question assigned to Scaffolding Expert (A-01): diff all variant pm.md files against common before deciding which to keep as overrides.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | scaffolding-expert | Diff all 4 variant pm.md files vs workspace agents/pm.md; document which are identical (can use common) vs which have intentional customizations (keep as override) | Immediate |
| A-02 | automation-engineer | Add skills sync to publish-to-template.ts; create scripts/sync-common-agents.ts | Immediate |
| A-03 | lifecycle-manager | Move 6 common skills to templates/common/skills/; delete per-variant duplicates; update validate-templates.ts expected skill counts | Within 1 week |
| A-04 | automation-engineer | Add 5 new validate-templates.ts checks (C-SK-01, C-AG-01, C-AG-02, C-CM-01, C-CM-02) | Within 1 week |
| A-05 | docs-writer | Add common management guide to CONSTITUTION.md §7: classification criteria, sync procedure, override mechanism | Within 2 weeks |

## Open Questions

- variant pm.md customizations: need diff analysis before Phase 2 migration (A-01 prerequisite)
- templates/common/agents/ README requirement: decided NO — common layer is not subject to variant-contract README rules

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | 6 common skills exist only in templates/common/skills/ (not duplicated in each variant) | `ls templates/co-*/skills/` shows no common skills |
| AC-02 | pm.md and lifecycle-manager.md in templates/common/agents/ | Both files present |
| AC-03 | validate-templates.ts warns on duplicate common skills in variant dirs | Test: copy meeting-facilitation to co-design/skills/ → warning appears |
| AC-04 | New project scaffolded from any variant includes all common skills and agents | Run new-project.sh, verify common skills/agents present |
| AC-05 | CONSTITUTION.md §7 has common management guide | Section present with classification criteria |
