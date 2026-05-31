# Meeting Transcript
**Date**: 2026-05-31
**Topic**: lifecycle-manager Version Management Effectiveness — Structural Defects in Versioning Policy and Coverage
**Participants**: architect, lifecycle-manager, auditor, automation-engineer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete
**Series**: Second lifecycle-manager meeting (extends meeting-2026-05-31-lifecycle-manager-coverage.md)

---

## Key Findings — Data-Driven

### Finding 1: 44 Scripts Lack @version Header (Critical)
SCRIPTS.md registers 44+ scripts with version numbers, but NO script file has an `@version` header. `lifecycle-sync-audit.ts` Check A silently skips files without `@version` — meaning SCRIPTS.md versions have never been validated against actual file state.

### Finding 2: 7/8 Agents Lack version: Field
Only `lifecycle-manager.md` has `version: 1.0.0`. All other agents use `last_updated:` only. No policy defines whether agents should be versioned or what bump rules apply.

### Finding 3: New Platform Skills Created Without version: Initialization
`.claude/skills/finishing-a-development-branch/SKILL.md` was created today without `version:` field. No creation checklist enforces initial version.

### Finding 4: lifecycle-manager dispatch trigger ≠ CLAUDE.md §9 table
CLAUDE.md §9 now has 9 lifecycle rows (including `.claude/commands/`, `.gemini/commands/`, etc.). AGENTS.md lifecycle-manager dispatch trigger table has 5 conditions. The two are out of sync.

### Finding 5: Version Bump Rules Not Specified in Agent Definition
lifecycle-manager performs SemVer bumps based on AI heuristics (no official specification). patch/minor/major criteria are implicit, inconsistent across sessions.

---

## Proposed Version Management Policy by Domain

| Domain | SSOT | Tracking Method | lifecycle-manager Action |
|--------|------|-----------------|--------------------------|
| Script | SCRIPTS.md | SCRIPTS.md version + @version in file (if present) | Bump SCRIPTS.md; sync @version if file has it; WARN if missing |
| Agent | File frontmatter | `last_updated:` date | Update last_updated to current date on any change |
| Project Skill | File frontmatter | `version:` field | Bump version + update AGENTS.md Skills table |
| Platform Skill (.claude/.gemini) | File frontmatter | `version:` field | Initialize 1.0.0 on creation; bump on change |
| Platform Command | N/A | Existence/parity only | Check via P-02; no version tracking |

---

## Transcript

**[Architect]**: (Round 1)

Three structural defects: (1) 44 scripts in SCRIPTS.md lack @version header — lifecycle-sync-audit.ts silently skips them, making SCRIPTS.md ↔ file version validation impossible; (2) 7/8 agents lack version: field — no tracking; (3) new .claude/skills/ files created without version: initialization. Root cause: lifecycle-manager definition has no version management specification.

**[Lifecycle Manager]**: (Round 1)

Confirmed: only version management specification in current role definition is "Update scripts/SCRIPTS.md — script status, version, removal-date fields." No bump rules, no SemVer criteria, no @version ↔ SCRIPTS.md relationship defined. Today's bumps were AI heuristics, not policy-driven. agents/*.md version field absent — no policy on whether agents need versioning.

**[Auditor]**: (Round 1)

lifecycle-sync-audit.ts Check A behavior: @version absent → silently skipped. This means 44 scripts with no @version have never had SCRIPTS.md version validated against actual state. Check C covers skills/ vs templates/common/skills/ but NOT .claude/skills/. Result: all platform skill versions are unchecked.

**[Automation Engineer]**: (Round 1)

Three directions proposed: A (backfill @version to 44 files), B (SCRIPTS.md as sole SSOT, remove Check A), C (hybrid: SCRIPTS.md as SSOT, @version optional but validated when present, required for new files). Recommended: Direction C. Also: lifecycle-sync-audit.ts should change silent skip to WARN for @version-missing scripts.

**[Architect]**: (Round 2)

Decided: agents use last_updated: (not version:) as primary tracking. Platform Skills need version: initialized at creation. Platform Commands need no version (existence/parity only). Proposed full domain × version policy table (5 rows). lifecycle-sync-audit.ts needs 3 enhancements.

**[Lifecycle Manager]**: (Round 2)

Drafted version management policy spec for inclusion in role definition. Key rule: Platform Skill creation must initialize version: 1.0.0. @version absence in scripts → WARN in drift report, not block. This resolves the immediate gap (finishing-a-branch SKILL.md missing version).

---

## Integrated Action Items (Both Lifecycle Meetings)

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| **Version management spec (new)** | | | | |
| B-01 | docs-writer | High | Rewrite `agents/lifecycle-manager.md`: 8 domains + L1 jurisdiction + expanded dispatch triggers (9 items) + Version Management Policy section (SSOT per domain, bump rules, @version handling) | High |
| B-02 | automation-engineer | Medium | Enhance `lifecycle-sync-audit.ts`: change silent skip → WARN for @version-absent scripts; add .claude/skills/ version drift check (Check C extension) | Medium |
| B-03 | automation-engineer | Low | Add `version: 1.0.0` to: `.claude/skills/finishing-a-development-branch/SKILL.md`, `.gemini/skills/finishing-a-development-branch/SKILL.md`, and both template common copies | Medium |
| **From first lifecycle meeting** | | | | |
| A-02 | docs-writer | Medium | Update `templates/common/agents/lifecycle-manager.md` (L2): add Platform Command/Skill domains | Medium |
| A-03 | docs-writer | Medium | Update AGENTS.md Phase 6 dispatch trigger table: add .claude/commands/, .gemini/commands/ change conditions | Medium |
| A-04 | automation-engineer | Low | Extend `common-contract.json`: add common_platform_skills section | Low |
| A-05 | docs-writer | Low | Sync CLAUDE.md §9 lifecycle table ↔ lifecycle-manager dispatch triggers (9 rows must match) | Low |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `agents/lifecycle-manager.md` has Version Management Policy section with per-domain rules | Manual review |
| C-02 | `lifecycle-sync-audit.ts` emits WARN (not silent) for @version-absent scripts | Run audit with known missing @version |
| C-03 | `.claude/skills/finishing-a-development-branch/SKILL.md` has `version: 1.0.0` | Read file |
| C-04 | AGENTS.md Phase 6 dispatch table has 9 rows matching CLAUDE.md §9 | Count rows in both |
| C-05 | `templates/common/agents/lifecycle-manager.md` includes Platform Command/Skill domains | Manual review |
| C-06 | bun scripts/audit.ts passes | Run audit |
