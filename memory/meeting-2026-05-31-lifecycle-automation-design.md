# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Lifecycle Version Management Automation — New Skills, Scripts, and Change Detection Mechanisms
**Participants**: architect, automation-engineer, security-expert, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Series**: Third lifecycle-manager meeting (extends meeting-2026-05-31-lifecycle-version-management.md)

---

## Coverage Gap Map (Domain × Layer)

| Domain | Detection | Processing (Skill) | Verification (Script) |
|--------|:---------:|:------------------:|:---------------------:|
| Script | ✅ pre-commit | ✅ script-lifecycle-manager | ⚠️ Check A skips missing @version |
| Agent | ⚠️ Last Updated only | ✅ agent-lifecycle-manager | ❌ none |
| Project Skill | ❌ not detected | ✅ skill-lifecycle-manager | ⚠️ partial |
| **Platform Skill** | ❌ **not detected** | ❌ **no skill** | ❌ **none** |
| **Platform Command** | ❌ **not detected** | ❌ **no skill** | ⚠️ P-02 (existence only) |
| Template Contract | ❌ **not detected** | ❌ in lifecycle-manager only | ❌ none |

---

## Proposed New Components

### New Skills

**`platform-skill-lifecycle-manager`**
- Trigger: `.claude/skills/` or `.gemini/skills/` changes
- Actions: initialize `version: 1.0.0` on creation, bump on change, sync with AGENTS.md, verify propagation to `templates/common/`
- Scope distinction: `skill-lifecycle-manager` → `skills/*/` (project-level); this skill → `.claude/skills/` + `.gemini/skills/` (platform-level)

**`platform-command-lifecycle-manager`**
- Trigger: `.claude/commands/` or `.gemini/commands/` changes
- Actions: verify `templates/common/` propagation, check `gemini-parity` policy, confirm `common-contract.json` registration

### New Scripts

**`scripts/hooks/post-write-lifecycle-check.ts`**
- Trigger: PostToolUse (Write|Edit), replaces direct `audit.ts` call (calls audit.ts internally)
- Behavior: NON-BLOCKING WARN mode
- Logic: `git diff --name-only` → detect unstaged changes → classify by domain → emit lifecycle warnings
- Patterns detected:
  - `.claude/skills/*/SKILL.md` → check version: field
  - `.gemini/skills/*/SKILL.md` → check version: field + .claude/ sync
  - `.claude/commands/*.md` → check templates/common/ propagation
  - `.gemini/commands/*.md` → check templates/common/ propagation
  - `agents/*.md` → check last_updated freshness

**`scripts/verify-platform-lifecycle.ts`**
- Integrated into `audit.ts`
- Check E: `.claude/skills/*/SKILL.md` version: field completeness (FAIL if missing)
- Check F: `.claude/skills/` ↔ `.gemini/skills/` version synchronization
- Check G: `.claude/commands/` registration completeness (parity with common)
- Check H: Platform Skill/Command propagation status to `templates/common/`

---

## Transcript

**[Architect]**: (Round 1)

Detection layer: 5 domains have zero automated detection. Processing layer: no skills for Platform Skill or Platform Command. Verification layer: Check A silently skips 44 scripts without @version. Proposed 2 new skills and 2 new scripts to close all gaps.

**[Automation Engineer]**: (Round 1)

pre-commit.ts extension design: 3 new branches for .claude/skills/, .gemini/skills/, .claude/commands/. PostToolUse cannot detect specific file paths from env — use `git diff --name-only` inside the hook script to identify changed files. post-write-lifecycle-check.ts design: non-blocking WARN mode via git diff.

**[Security Expert]**: (Round 1)

PostToolUse feasibility confirmed: `git diff --name-only` on unstaged changes (post-Write/Edit) reliably identifies changed files. Non-blocking WARN is correct — lifecycle processing should not interrupt editing flow. Blocking belongs in pre-commit.

**[Auditor]**: (Round 1)

lifecycle-sync-audit.ts Check A fix: silent skip → WARN. Proposed Check E (version completeness), F (version sync), G (registration), H (propagation) as dedicated `verify-platform-lifecycle.ts`. Integrate into audit.ts for automatic execution on PostToolUse and pre-commit.

**[Architect]**: (Round 2)

Full implementation roadmap: 2 new skills, 2 new scripts, 3 existing improvements. Scope distinction between skill-lifecycle-manager (project-level) and platform-skill-lifecycle-manager (platform-level) must be explicit in AGENTS.md.

**[Automation Engineer]**: (Round 2)

Dependency graph: verify-platform-lifecycle.ts → integrated into audit.ts → called by pre-commit.ts. post-write-lifecycle-check.ts → replaces direct audit.ts in PostToolUse. Key constraint: PostToolUse runs at project root; git diff --name-only works correctly there.

---

## Final Integrated Action Items (All 3 Lifecycle Meetings)

| # | Category | Owner | Tier | Deliverable | Priority |
|---|----------|-------|------|-------------|----------|
| **New Skills** | | | | | |
| S-01 | New | automation-engineer | Medium | `.claude/skills/platform-skill-lifecycle-manager/SKILL.md` | High |
| S-02 | New | automation-engineer | Medium | `.claude/skills/platform-command-lifecycle-manager/SKILL.md` | High |
| **New Scripts** | | | | | |
| SC-01 | New | automation-engineer | High | `scripts/hooks/post-write-lifecycle-check.ts` (PostToolUse, non-blocking WARN) | High |
| SC-02 | New | automation-engineer | High | `scripts/verify-platform-lifecycle.ts` (Check E/F/G/H, integrated into audit.ts) | High |
| **Existing Improvements** | | | | | |
| EX-01 | Improve | automation-engineer | Medium | `lifecycle-sync-audit.ts` Check A: silent skip → WARN for @version-absent scripts | Medium |
| EX-02 | Improve | automation-engineer | Medium | `pre-commit.ts`: add .claude/skills/, .gemini/skills/, .claude/commands/ change branches | Medium |
| EX-03 | Improve | automation-engineer | Low | `.claude/settings.json` PostToolUse: replace `audit.ts` with `post-write-lifecycle-check.ts` | Medium |
| **lifecycle-manager Role Rewrite** | | | | | |
| B-01 | Rewrite | docs-writer | High | `agents/lifecycle-manager.md`: 8 domains + L1 jurisdiction + 9 dispatch triggers + Version Management Policy | High |
| B-03 | Immediate | automation-engineer | Low | Add `version: 1.0.0` to 4 `finishing-a-development-branch/SKILL.md` files | Medium |
| A-02 | Prior mtg | docs-writer | Medium | `templates/common/agents/lifecycle-manager.md`: Platform Command/Skill domains | Medium |
| A-03 | Prior mtg | docs-writer | Medium | AGENTS.md Phase 6 dispatch table: platform command/skill change conditions | Medium |
| A-04 | Prior mtg | automation-engineer | Low | `common-contract.json`: common_platform_skills section | Low |
| A-05 | Prior mtg | docs-writer | Low | Sync CLAUDE.md §9 ↔ lifecycle-manager triggers (9 rows) | Low |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `post-write-lifecycle-check.ts` exists and emits WARN on .claude/skills/ change without version: | Manual test |
| C-02 | `verify-platform-lifecycle.ts` exists and integrated into audit.ts | bun scripts/audit.ts output |
| C-03 | `platform-skill-lifecycle-manager/SKILL.md` exists with correct triggers | File check |
| C-04 | `platform-command-lifecycle-manager/SKILL.md` exists with correct triggers | File check |
| C-05 | lifecycle-sync-audit.ts emits WARN (not silent) for @version-absent scripts | Run audit |
| C-06 | pre-commit.ts detects .claude/skills/ changes and checks version: field | Test with staged .claude/skills/ file |
| C-07 | `agents/lifecycle-manager.md` has Version Management Policy and 8 domains | Manual review |
| C-08 | `finishing-a-development-branch/SKILL.md` (all 4 copies) has version: 1.0.0 | Read files |
| C-09 | bun scripts/audit.ts passes | Run audit |
