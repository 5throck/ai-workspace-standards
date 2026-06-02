# Meeting Transcript
**Date**: 2026-06-02
**Topic**: L2 Migration Folder Removal and Skill Location Consistency Review
**Participants**: architect, auditor, pm, lifecycle-manager
**Rounds**: 2
**Language**: Korean
**Status**: Complete

---

## Transcript

**[PM]** (Facilitator):

Good afternoon. I will start the meeting. Today's agenda consists of two items:

1. Confirmation that the migrations folder is not needed at L2 (templates/ level), discussion of removal approach
2. Review of inconsistency issues between skills in skills/ folder and skills in .claude/.gemini/

In the first round, I request initial analysis and problem definition for each agenda item.

---

**[Architect]** (Round 1):

I will address the migrations folder issue first. After reviewing the docs/migrations/ structure, this folder currently contains only one migration guide for the co-security variant.

The problem is that this contradicts the SSOT principle of being a **template creation-time snapshot**.

The L3 (new project) layer should evolve independently as a creation-time snapshot. The essential purpose of migration guides is to support version upgrades of existing projects, but including them in templates means this guide is copied to every new project.

I strongly argue that migration documentation should not belong to the L2 template layer. Migration guides should be managed in the workspace root's docs/ or a separate migration section, and excluded from templates.

---

**[Auditor]** (Round 1):

I agree with architect's opinion. I re-reviewed the 3-layer SSOT principle in CONSTITUTION.md, and the current migrations folder causes the following problems:

1. **Unnecessary duplication**: The same migration guide is copied to all new projects
2. **Management burden**: All templates must be synchronized when migration guides are updated
3. **Purpose mismatch**: Migration guides are for upgrading existing projects, not template creation

Additionally, I reviewed the skills/ location consistency issue. Currently, the audit-workspace skill is duplicated across 8 locations (root + 7 templates), which can cause similar problems:

- **Metadata inconsistency**: Each location's skill version or last_reviewed date may differ
- **Synchronization burden**: All 8 locations must be modified when updating skills
- **Compliance risk**: Different skill content can lead to different behaviors in different projects

Proposal: Remove migrations folder from L2, and a consistent strategy is needed for skill locations.

---

**[Lifecycle-Manager]** (Round 1):

As the skill lifecycle manager, both issues appear serious.

Regarding migrations folder removal, I completely agree. After reviewing docs/constitution/06-skill-lifecycle.md and 06.5-script-lifecycle.md, migration guides are not template components. They are operational documentation, not development resources.

Regarding the skill location issue, it's more complex. According to the current AGENTS.md § Skills table:

- **Local project skills**: `skills/<name>/SKILL.md` (priority 1)
- **Platform config skills**: `.claude/skills/` or `.gemini/skills/` (priority 2)
- **Global plugin skills**: `superpowers/` etc. (priority 3)

The problem is that the audit-workspace skill exists in all three locations. This can cause priority conflicts and may contradict the current "Skill Resolution Priority" section in AGENTS.md.

Proposal: To simplify skill locations, we must choose one of the following:
1. Place skills only in `skills/` (current workspace root standard)
2. Place skills only in `.claude/skills/` (Claude Code native)
3. Clarify priority hierarchy and allow duplication but automate synchronization

---

**[Architect]** (Round 2):

I will provide feedback on lifecycle-manager's proposal.

The third option (maintain priority hierarchy + automation) is technically possible but has too high a risk of error. In my experience, duplication always leads to synchronization inconsistency.

The structural solution I propose:
1. **migrations folder**: Migration guides are now located at docs/migrations/ at workspace root
2. **skill locations**: Simplify to two tiers
   - Workspace root: Maintain only `skills/` (priority 1)
   - Platform-specific: `.claude/skills/` and `.gemini/skills/` should only contain platform-specific skills

This maintains SSOT principles while supporting platform-specific requirements.

Specific question: auditor, after reviewing actual usage patterns of audit-workspace skill, did you discover any content inconsistencies between the three locations?

---

**[Auditor]** (Round 2):

I will answer architect's question. After comparing audit-workspace skills across 8 locations:

**Urgent finding**: Although skill content is currently consistent across all locations, **metadata inconsistency was discovered**:

- `skills/audit-workspace/SKILL.md`: last_reviewed: 2026-05-30
- `.claude/skills/audit-workspace/SKILL.md`: last_reviewed: 2026-05-28 (2-day difference)
- Some template locations: Missing version field

This requires immediate correction. More seriously, during my review, I could not determine how this inconsistency occurred. It appears someone updated only one location without synchronizing the others.

Regarding the migration folder removal proposal, I completely agree. I propose an execution plan:

| Step | Task | Owner | Risk |
|------|------|--------|------|
| 1 | Verify migration guides are at docs/migrations/ | docs-writer | Low |
| 2 | Update related references (README, etc.) | docs-writer | Low |
| 3 | Integrate skill locations and synchronize metadata | lifecycle-manager | Medium |

---

**[Lifecycle-Manager]** (Round 2):

Auditor's finding is very concerning. A 2-day metadata difference may seem small, but it's a symptom of a larger problem. After re-reviewing docs/constitution/06-skill-lifecycle.md § Cross-Platform Deployment Rule, the current process is not clear.

My final proposal:

**Agenda 1: migrations folder**
- **Decision**: Migration guides are located at docs/migrations/ (workspace root)
- **Reason**: Comply with SSOT principle, prevent unnecessary duplication

**Agenda 2: skill locations**
- **Decision**: Place skills only in `skills/` (priority 1), use `.claude/skills/` and `.gemini/skills/` only for platform hooks/commands
- **Reason**: Eliminate duplication, reduce synchronization burden, improve compliance
- **Execution**: Update AGENTS.md priority rules to specify this explicitly

Specific question: PM, do you approve these two proposals? Considering architect's structural analysis and auditor's inconsistency findings, immediate execution appears necessary.

---

## Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | docs-writer | Medium | Update migrations folder references in related documentation | 4 |
| A-02 | lifecycle-manager | Medium | Update AGENTS.md § Skill Resolution Priority rules | 4 |
| A-03 | auditor | Medium | Synchronize audit-workspace skill metadata and audit | 4 |
| A-04 | auditor | Medium | Perform final skill location consistency audit | 6 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | docs/migrations/ contains all migration guides | Migration guides accessible at new location |
| AC-02 | All documentation references updated to new location | grep shows no remaining references to templates/common/migrations |
| AC-03 | AGENTS.md § Skill Resolution Priority updated to specify single location rule | Section updated and clarity verified |
| AC-04 | audit-workspace skill metadata consistent across all locations | Version and last_reviewed dates identical |
| AC-05 | All skills located only in skills/ folder for workspace-level functionality | No workspace-level skills in .claude/skills/ or .gemini/skills/ |
