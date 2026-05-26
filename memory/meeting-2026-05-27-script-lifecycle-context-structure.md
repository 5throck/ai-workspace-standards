# Meeting Transcript
**Date**: 2026-05-27
**Topic**: (1) Script lifecycle management — workspace root and templates / (2) context.md structuring — common immutable + variant-specific separation
**Participants**: pm, architect, automation-engineer, scaffolding-expert, docs-writer, security-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript translated to English per documentation standards)
**Status**: Complete

---

## Transcript

### Round 1

**Architect**: Presented SSOT (Single Source of Truth) and propagation direction clarification as the core proposal. Proposed introducing a SCRIPTS.md manifest with source/version/status fields. Proposed splitting context.md (common, immutable) from variant-specific files. Proposed using verify-scripts.ts for automated drift detection.

**Automation-Engineer**: Flagged the risk of manual SCRIPTS.md management. Proposed dual flags for verify-scripts.ts: `--generate` (auto-generate) and `--verify` (drift detection). Proposed adding deprecated script warnings to dev-sync.sh. Proposed correcting hooks installation order in new-project.sh (immediately after git init, before first commit).

**Scaffolding-Expert**: Confirmed the vulnerability in current new-project.sh where hooks are installed after the first commit. Proposed adding `docs/context.md merge=ours` to .gitattributes. Argued for an explicit reading order declaration in CLAUDE.md (context.md → variant.context.md).

**Docs-Writer**: Raised file naming consistency issues. Proposed the `co-develop.context.md` pattern (extension expressing the hierarchical relationship). Argued that SCRIPTS.md should also serve as developer documentation.

**Security-Expert**: Classified the context.md modification prohibition as a convention control rather than a security control. Proposed a pre-commit warning and audit.sh history-detection approach. Proposed adding a `removal-date` field to SCRIPTS.md with a hard block when the date is exceeded.

**Auditor**: Confirmed no role overlap between verify-skills.ts and verify-scripts.ts. Identified two open issues: (1) file naming inconsistency, (2) SCRIPTS.md single file vs. split files.

### Round 2

**Architect**: Confirmed adoption of the `co-develop.context.md` naming convention. Proposed a dual-section structure for SCRIPTS.md (`## Registry` + `## Guide`) to maintain a single file while separating concerns.

**Automation-Engineer**: Established the 3-layer ownership model (L0: templates/common, L1: workspace, L2: project). Presented sample code for deprecated script warnings. Clarified that removal-date applies only to L0.

**Scaffolding-Expert**: Confirmed the need for a migration script. `migrate-context.sh` should generate a draft only (no auto-commit). Presented the improved code path for new-project.sh.

**Docs-Writer**: Presented a draft CONSTITUTION.md script management section structure (Ownership Layers table + Script States + Propagation Rule). Proposed verify-context.ts (automated verification of `*.context.md` existence and CLAUDE.md reading order).

**Security-Expert**: Raised the issue of stale vulnerable scripts in L2 projects. Proposed adding a `security-advisory` field with a hard block mechanism. Proposed handling the context.md initialization exception via a `CONTEXT_INIT=1` environment variable.

---

## Action Items

| # | Owner | Deliverable | Phase |
|---|-------|-------------|-------|
| B-01 | Architect | Design SCRIPTS.md draft (Registry + Guide dual-section; source/version/status/removal-date/security-advisory fields) | Design |
| B-02 | Automation-Engineer | Implement scripts/verify-scripts.ts (--generate / --verify flags, pre-commit integration) | Implementation |
| B-03 | Architect + Docs-Writer | Define common area in templates/common/docs/context.md and design variant *.context.md separation | Design |
| B-04 | Scaffolding-Expert | Modify new-project.sh — correct hooks install order, add .gitattributes merge=ours, declare CLAUDE.md reading order | Implementation |
| B-05 | Docs-Writer | Add Script Lifecycle Management section to CONSTITUTION.md + define additional audit.sh checks | Documentation |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | SCRIPTS.md Registry section is machine-parseable | verify-scripts.ts --verify passes |
| C-02 | Each variant folder contains a *.context.md file | Passes after adding audit.sh check |
| C-03 | pre-commit hook is active at first commit in new-project.sh | New project creation test |
| C-04 | CLAUDE.md explicitly declares context.md → variant.context.md reading order | Review all variant CLAUDE.md files |
| C-05 | pre-commit hard blocks when deprecated script removal-date is exceeded | verify-scripts.ts unit test |
