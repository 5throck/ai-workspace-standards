# Meeting Transcript
**Date**: 2026-05-27
**Topic**: (1) Template directory change review and new project scaffolding system audit / (2) Agent and skill lifecycle management system review
**Participants**: pm, architect, scaffolding-expert, automation-engineer, security-expert, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript translated to English per documentation standards)
**Status**: Complete

---

## Transcript

### Round 1

**Architect**: Identified a skills layer mismatch as the core structural problem. `templates/common/skills/` contains the lifecycle manager skill, but `C:/git/skills/` does not. `agent-lifecycle-audit.ts` and `skill-lifecycle-audit.ts` are missing from the workspace root. Requested verification that the variant parameter is correctly passed through commands.

**Scaffolding-Expert**: Confirmed a bug where `$ARGUMENTS` is parsed as a single element into PROJECT_NAME. The `--variant` flag cannot be passed through commands. Flagged the risk of audit false positives if AGENTS.md is elevated to common.

**Automation-Engineer**: Confirmed shell behavior where `"$@"` is parsed as a single array element. Proposed two solutions — Solution A (remove quotes) and Solution B (separate parsing in command). Flagged bun runtime dependency as a concern.

**Security-Expert**: Confirmed that lifecycle audit scripts are not connected to any hook. Flagged a path traversal risk. Noted that duplicate files in `co-develop/.claude/skills/` could serve as a security policy override vector.

**Docs-Writer**: The duplication between `co-develop/.claude/skills/skill-lifecycle-manager` and `common/skills/` violates the common layer design principle. Flagged the operational risk of skills appearing in system-reminder but not existing on disk.

**Auditor**: Summarized audit.sh coverage gaps — skills registry cross-check, template sync, duplicate files, and hook connectivity are all currently undetectable. Asked Architect whether the lifecycle manager omission was an intentional design decision.

### Round 2

**Architect**: Confirmed the omission is a bug. Proposed `templates/common/skills/` as the single source of truth for skills. Proposed extending audit.sh. Proposed improving command argument parsing.

**Scaffolding-Expert**: Confirmed the copy path `common/skills/` → `.claude/skills/` during new project creation. Proposed a `sync-workspace-skills.sh` script for workspace root synchronization.

**Automation-Engineer**: Presented bash implementation for audit.sh checks. Proposed introducing an independent skills registry file (REGISTRY.json). Presented a PROJECT_NAME validation regex.

**Security-Expert**: Approved the validation pattern and added a length limit. Recommended removing duplicate files from co-develop. Emphasized bun environment availability as a prerequisite.

**Docs-Writer**: Flagged the absence of lifecycle management usage documentation. Proposed adding a "Lifecycle Management" section to AGENTS.md.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| A-01 | Automation-Engineer | Copy lifecycle manager skill to `C:/git/skills/` and remove co-develop duplicate | Immediate |
| A-02 | Automation-Engineer | Add PROJECT_NAME validation to new-project.sh/.ps1 | Immediate |
| A-03 | Automation-Engineer | Add skills registry cross-check to audit.sh/.ps1 | After A-01 |
| A-04 | Docs-Writer | Add "Lifecycle Management" section to AGENTS.md | Parallel with A-01 |
| A-05 | Architect + PM | Decide skills registry management approach before A-03 design | Before A-03 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `C:/git/skills/agent-lifecycle-manager` and `skill-lifecycle-manager` exist | `ls C:/git/skills/` |
| C-02 | `co-develop/.claude/skills/skill-lifecycle-manager` removed | Confirm file absence |
| C-03 | new-project.sh exits 1 on special characters in PROJECT_NAME | `bash scripts/new-project.sh "test;rm -rf"` |
| C-04 | audit.sh outputs FAIL when a skill registered in AGENTS.md is missing on disk | Delete a skill, run audit |
| C-05 | "Lifecycle Management" section exists in AGENTS.md | grep check |
