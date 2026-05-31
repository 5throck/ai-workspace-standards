# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Workspace Root Changes Not Propagated to Templates — Structural Root Cause and Improvement Plan
**Participants**: architect, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

Files created at the workspace root `.claude/` level are NOT automatically propagated to `templates/common/.claude/`, meaning generated projects do not receive these files.

**Specific gaps found this session:**

| File | Root | templates/common | Generated Project | Status |
|------|:----:|:----------------:|:-----------------:|--------|
| `.claude/commands/commit-push-pr.md` | ✅ | ❌ | ❌ | Missing |
| `.claude/skills/finishing-a-development-branch/SKILL.md` | ✅ | ❌ | ❌ | Missing |
| `.claude/settings.json` (PostToolUse) | ✅ | ✅ | ✅ | OK |
| `scripts/hooks/pre-commit.ts` message fix | ✅ | ✅ | ✅ | OK |

---

## Propagation Path Structure

```
templates/common/.claude/commands/  → copied to ALL generated projects
templates/<variant>/.claude/commands/ → copied to THAT variant's projects only
root .claude/commands/              → workspace ONLY, never copied to generated projects
```

`templates/common/.claude/` currently contains only:
- `commands/` (6 files: changelog, meeting, memlog, new-project, new-task, sync)
- `settings.json`

Missing: `skills/` directory entirely absent from `templates/common/.claude/`.

---

## Root Cause

No lifecycle rule exists for: "when adding to root `.claude/commands/` or `.claude/skills/`, also add to `templates/common/.claude/`."

`validate-templates.ts` Check 6 validates common ↔ variant command parity, but does NOT check root ↔ common parity.

`common-contract.json` has no `common_commands` section — commands are outside the governance contract.

---

## Transcript

**[Architect]**: (Round 1)

Three-layer problem: (1) propagation path structure — root .claude/ is workspace-only; (2) .claude/skills/ directory missing from templates/common/.claude/; (3) common-contract.json has no commands governance.

**[Automation Engineer]**: (Round 1)

Option A (recommended): add files directly to templates/common/.claude/. New-project.ps1 uses `robocopy $CommonDir $ProjectDir /E` — all files in common are automatically copied. Also add Check P-02 to validate-templates.ts for root ↔ common command parity. Option B (inject-global-plugins.ts) requires script changes. Option C (common-contract.json registration) provides governance but not propagation.

**[Auditor]**: (Round 1)

Four gaps: (1) root ↔ common commands parity not validated; (2) no .claude/skills/ in common; (3) validate-templates.ts Check 6 misses root↔common; (4) common-contract.json has no commands governance.

**[Architect]**: (Round 2)

Immediate: add two files. Structural: add Check P-02 to validate-templates.ts. Lifecycle: add rules to CLAUDE.md §9 and GEMINI.md §9. Governance: register commit-push-pr in common-contract.json.

**[Automation Engineer]**: (Round 2)

Check P-02 spec: compare root .claude/commands/ file list vs templates/common/.claude/commands/ file list, fail if root has files not in common. Also add CLAUDE.md §9 lifecycle rule rows for .claude/commands/ and .claude/skills/ changes.

---

## Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | automation-engineer | Low | Add `templates/common/.claude/commands/commit-push-pr.md` (identical to root) | High |
| A-02 | automation-engineer | Low | Add `templates/common/.claude/skills/finishing-a-development-branch/SKILL.md` (identical to root) | High |
| A-03 | automation-engineer | Medium | Add Check P-02 to `validate-templates.ts`: root ↔ common .claude/commands/ parity | Medium |
| A-04 | docs-writer | Low | Add `.claude/commands/` and `.claude/skills/` rows to CLAUDE.md + GEMINI.md §9 Lifecycle Management Rules table | Medium |
| A-05 | automation-engineer | Low | Register `commit-push-pr` command in `common-contract.json` | Low |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `templates/common/.claude/commands/commit-push-pr.md` exists with /sync redirect | File check |
| C-02 | `templates/common/.claude/skills/finishing-a-development-branch/SKILL.md` exists | File check |
| C-03 | `bun scripts/validate-templates.ts` fails when root has command not in common | Test with known mismatch |
| C-04 | CLAUDE.md and GEMINI.md §9 table has .claude/commands/ and .claude/skills/ rows | Manual review |
| C-05 | bun scripts/audit.ts passes | Run audit |
