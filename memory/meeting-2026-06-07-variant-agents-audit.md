# Meeting Transcript
**Date**: 2026-06-07
**Topic**: Variant template AGENTS.md mis-registration and missing role frontmatter
**Participants**: architect, automation-engineer, auditor, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

### Round 1

**architect**: Both issues stem from a single structural mistake: templates/common/AGENTS.md was copied as the base for variant AGENTS.md files, but it contains workspace-root-only agents (auditor, architect, etc.). Variants don't include these agents, so variant AGENTS.md should have been independently managed. The missing `role:` frontmatter is because variant agent files were created based on workspace root format (name:, tier: focused) without the role: field. Fix requires two layers: (1) immediate rewrite of each variant AGENTS.md and add role: fields, (2) structural prevention via validate-templates.ts checks.

**automation-engineer**: Confirmed validate-templates.ts has no cross-validation between AGENTS.md registrations and agents/ file existence. agent-lifecycle-audit.ts handles this but only runs inside scaffolded projects, not against templates/ directly. Templates' quality is unverified until a project is actually created. Recommends adding template-level AGENTS.md validation to validate-templates.ts to prevent recurrence.

**lifecycle-manager**: Identified three AGENTS.md layers: (1) workspace root AGENTS.md — root agents, (2) templates/common/AGENTS.md — currently identical to root, (3) templates/co-*/AGENTS.md — should contain variant-specific agents only. Correct design: templates/common/AGENTS.md should contain only agents common to all variants (pm, lifecycle-manager), and each co-*/AGENTS.md should extend that base with variant-specific agents.

**auditor**: Confirmed no template-level agent audit exists — agent:verify only checks workspace root. This is why the problem went undetected. Two dependencies to verify before changes: (1) whether propagate-to-templates.ts or publish-to-template.ts auto-syncs AGENTS.md (would overwrite fixes on next sync), (2) whether validate-templates.ts P-01 check includes AGENTS.md comparison.

### Round 2

**architect**: The auto-sync overwrite risk is the critical prerequisite. If templates/common/AGENTS.md is auto-copied from root, fixes will be reverted on next /sync. Solution: exclude AGENTS.md from publish pipeline, or change pipeline from overwrite to merge. Short-term: add COMMON-EXCLUDE marker. Medium-term: add validate-templates.ts template AGENTS.md integrity check.

**automation-engineer**: Proposes alternative to COMMON-EXCLUDE: rewrite templates/common/AGENTS.md as a truly variant-neutral minimal form (pm + lifecycle-manager only). Each templates/co-*/AGENTS.md then adds variant agents. This is self-documenting and requires no meta-control markers.

**lifecycle-manager**: Synthesizes execution order: (1) verify publish pipeline AGENTS.md behavior, (2) rewrite templates/common/AGENTS.md to minimal form + exclude from pipeline if needed, (3) rewrite each variant AGENTS.md, (4) add validate-templates.ts check.

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| A-01 | automation-engineer | Low | Verify if publish-to-template.ts auto-syncs AGENTS.md | Both | Immediate (prerequisite) |
| A-02 | automation-engineer | Low | Rewrite templates/common/AGENTS.md to minimal form (pm + lifecycle-manager only) | Both | After A-01 |
| A-03 | automation-engineer | Low | Rewrite 5 variant templates/co-*/AGENTS.md based on actual agent files | Both | Parallel with A-02 |
| A-04 | automation-engineer | Low | Add role: frontmatter to all variant agent files (5 variants) | Both | Parallel with A-03 |
| A-05 | automation-engineer | Low | Add template-level AGENTS.md integrity check to validate-templates.ts | Both | Short-term |
| A-06 | lifecycle-manager | Medium | Lifecycle Update (version bump, SCRIPTS.md) | Both | After A-01~04 |
| A-07 | auditor | Medium | Final QA Audit (bun scripts/audit.ts) | Both | After A-06 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | No workspace-root agents in any variant AGENTS.md | bun scripts/agent-lifecycle-audit.ts in scaffolded project |
| AC-02 | All variant agent files have role: frontmatter | grep -r "^role:" templates/co-*/agents/ |
| AC-03 | validate-templates.ts detects AGENTS.md mismatches | bun scripts/validate-templates.ts --variant co-consult |
| AC-04 | bun scripts/audit.ts passes with 0 errors | audit output |
