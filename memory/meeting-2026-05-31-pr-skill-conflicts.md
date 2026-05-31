# Meeting Transcript
**Date**: 2026-05-31
**Topic**: PR Creation Skill Conflicts — /sync vs finishing-a-development-branch vs commit-push-pr
**Participants**: architect, automation-engineer, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

Three distinct paths exist for PR creation in this workspace, with overlapping triggers and conflicting gate requirements:

- **Path A — `/sync`**: memlog → sync-md → CHANGELOG gate → audit.ts gate → new `pr/date-slug` branch → commit → push → gh pr create
- **Path B — `superpowers:finishing-a-development-branch`**: test verification → current branch → 4-option menu → gh pr create (own format)
- **Path C — `commit-commands:commit-push-pr`**: git status → commit on current branch → push → gh pr create

**Incident this session**: After `/sync` created PR #161, `commit-push-pr` skill loaded and attempted execution on the same `pr/...` branch. Found nothing to commit and failed silently.

---

## Transcript

**[Architect]**: (Round 1)

Five conflict points identified:
1. Branch strategy: `/sync` always creates `pr/` branch; other paths use current branch
2. CHANGELOG gate: only `/sync` blocks on missing entries
3. audit.ts gate: only `/sync` enforces this
4. Memory logging: only `/sync` writes to memory/
5. PR body format: three different formats in use

**[Automation Engineer]**: (Round 1)

`commit-push-pr` on a `pr/` branch with clean working tree → silent failure. Reverse order (commit-push-pr first) would bypass all gates. `finishing-a-development-branch` runs test suite detection — this workspace has no standard test command, so skill may skip to PR options without audit. Trigger overlap: "create PR" → all three paths could fire.

**[Docs Writer]**: (Round 1)

Intended contexts differ (sync pipeline vs worktree cleanup vs quick fix) but outcomes overlap (PR creation). No document currently states `/sync` is the required path. CLAUDE.md §2 lists `/sync` but doesn't prohibit other paths.

**[Auditor]**: (Round 1)

Confirmed one real incident this session. Identified risk: if `finishing-a-development-branch` runs before audit, all quality gates are bypassed.

**[Architect]**: (Round 2)

Recommended Option A+C: CLAUDE.md explicit prohibition rule + local skill override for `finishing-a-development-branch`. Local skills (`.claude/skills/`) are Priority 2 and override global plugins (Priority 3).

**[Automation Engineer]**: (Round 2)

Local skill override design specified. Key gap: `commit-commands:commit-push-pr` has a plugin namespace prefix — local override by exact name matching may not work. CLAUDE.md rule is the only reliable coverage for this path.

**[Docs Writer]**: (Round 2)

Two-layer approach: (1) CLAUDE.md §12 declarative rule with enforcement weight equal to §5 PM Gateway, (2) local skill override for `finishing-a-development-branch`, (3) sync.md explicit statement. GEMINI.md parity required.

---

## Conflict Map

| Item | `/sync` | `finishing-a-branch` | `commit-push-pr` |
|------|---------|---------------------|-----------------|
| CHANGELOG gate | ✅ required | ❌ absent | ❌ absent |
| audit.ts gate | ✅ required | ❌ absent | ❌ absent |
| Branch strategy | `pr/date-slug` (new) | current branch | current branch |
| memlog write | ✅ | ❌ | ❌ |
| Trigger overlap | explicit /sync | "finish/wrap up" | "create PR" |

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| A-01 | docs-writer | Medium | Add §12 "PR Creation Rule" to CLAUDE.md and GEMINI.md: `/sync` is the only PR creation path; all other paths are prohibited for workspace-level commits |
| A-02 | automation-engineer | Low | Create `.claude/skills/finishing-a-development-branch/SKILL.md` as local override redirecting to `/sync` |
| A-03 | automation-engineer | Low | Update `.claude/commands/sync.md` to state "This is the ONLY PR creation path in this workspace" |
| A-04 | docs-writer | Low | Apply identical rule to GEMINI.md sync command description (platform parity) |

## Open Issue

`commit-commands:commit-push-pr` uses a plugin namespace prefix — technical blocking via local skill override is not reliable. Coverage via CLAUDE.md rule only.

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | CLAUDE.md and GEMINI.md both contain §12 PR Creation Rule | Manual review |
| C-02 | `.claude/skills/finishing-a-development-branch/SKILL.md` exists and redirects to /sync | File existence + content check |
| C-03 | `.claude/commands/sync.md` states it is the only PR path | Manual review |
| C-04 | bun scripts/validate-templates.ts passes | Run validation |
