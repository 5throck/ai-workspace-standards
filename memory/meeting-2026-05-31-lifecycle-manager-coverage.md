# Meeting Transcript
**Date**: 2026-05-31
**Topic**: lifecycle-manager Role Re-definition — Coverage Gaps in Lifecycle Management Domains
**Participants**: architect, lifecycle-manager, auditor, docs-writer
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

The lifecycle-manager agent (both workspace root and template versions) has a narrowly defined jurisdiction that does not cover several artifact categories that now require lifecycle management:

**Currently declared jurisdiction (L0):**
- `agents/*.md`
- `skills/*/SKILL.md`
- `scripts/SCRIPTS.md`
- Governance docs: `lifecycle-governance.json`, `common.lifecycle.json`, `VERSION_REGISTRY.json`

**Uncovered but lifecycle-relevant artifacts (discovered this session):**
- `.claude/commands/` and `.gemini/commands/`
- `.claude/skills/` and `.gemini/skills/`
- `templates/common/` L1 layer (entire layer has no lifecycle owner)
- `common-contract.json`
- Platform documentation files (CLAUDE.md, GEMINI.md)

---

## Structural Problems Identified

1. **Domain gaps**: Platform Command/Skill (`.claude/`, `.gemini/`) and Template Contract (`common-contract.json`) are not lifecycle domains
2. **L1 layer ownership gap**: No lifecycle owner for `templates/common/` changes
3. **Dispatch trigger mismatch**: CLAUDE.md §9 table has 9 lifecycle rows; lifecycle-manager trigger covers fewer cases
4. **Template lifecycle-manager (L2) also under-scoped**: Generated project lifecycle-manager lacks Platform Command/Skill domain

---

## Proposed Domain Expansion (5 → 8 domains)

| # | Domain | Path | L0 | L1 | L2 |
|---|--------|------|:--:|:--:|:--:|
| 1 | Agent | `agents/*.md` | ✅ | ✅ | ✅ |
| 2 | Skill (project) | `skills/*/SKILL.md` | ✅ | ✅ | ✅ |
| 3 | Script | `scripts/*.ts` + SCRIPTS.md | ✅ | ✅ | ✅ |
| 4 | Variant | `templates/*/variant.json` | ✅ | — | — |
| 5 | README | `README.md`, `README_ko.md` | ✅ | ✅ | ✅ |
| **6** | **Platform Command** | `.claude/commands/`, `.gemini/commands/` | **New** | **New** | **New** |
| **7** | **Platform Skill** | `.claude/skills/`, `.gemini/skills/` | **New** | **New** | **New** |
| **8** | **Template Contract** | `common-contract.json`, lifecycle fields | **New** | — | — |

---

## Transcript

**[Architect]**: (Round 1)

Official jurisdiction of lifecycle-manager vs actual lifecycle-relevant artifacts in the workspace show major gaps. `.claude/commands/`, `.claude/skills/`, `.gemini/commands/`, `.gemini/skills/`, `templates/common/`, and `common-contract.json` are all uncovered. CLAUDE.md §9 now lists these as lifecycle targets but lifecycle-manager agent definition does not match.

**[Lifecycle Manager]**: (Round 1)

Confirmed: `.claude/commands/commit-push-pr.md` created this session is outside declared jurisdiction. 8+ lifecycle items from this session were not processed. The 5-domain × 3-layer claim is undocumented — the 5 domains are never explicitly listed. L1 (templates/common/) changes have no lifecycle owner.

**[Auditor]**: (Round 1)

Enumerated 8 uncovered lifecycle items from this session. Concluded this is a structural coverage absence, not a one-off omission.

**[Docs Writer]**: (Round 1)

Five documentation defects in lifecycle-manager role definition: (1) domain list not enumerated; (2) platform command/skill domain absent; (3) L1 jurisdiction undefined; (4) dispatch trigger incomplete — missing platform command/skill changes and common-contract changes; (5) template lifecycle-manager (L2) also under-scoped.

**[Architect]**: (Round 2)

Proposed 8-domain model. L1 tracking: add to lifecycle-manager(L0) scope rather than creating a separate L1 role. Platform Command/Skill tracking: use common-contract.json as registry rather than a new COMMANDS.md file.

**[Lifecycle Manager]**: (Round 2)

Feedback: Platform Command/Skill needs existence/sync tracking, not version tracking. common-contract.json extension is the practical approach. Identified CLAUDE.md §9 ↔ lifecycle-manager trigger sync gap as a meta-lifecycle issue.

---

## Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | docs-writer | High | Rewrite `agents/lifecycle-manager.md`: enumerate 8 domains explicitly, add L1 (templates/common/) jurisdiction, expand dispatch triggers to 9 items matching CLAUDE.md §9 table | High |
| A-02 | docs-writer | Medium | Update `templates/common/agents/lifecycle-manager.md` (L2): add Platform Command/Skill domain (domains 6 and 7) | Medium |
| A-03 | docs-writer | Medium | Update AGENTS.md Phase 6 dispatch trigger table: add Platform Command/Skill changes as lifecycle-manager dispatch conditions | Medium |
| A-04 | automation-engineer | Low | Extend `common-contract.json`: add `common_platform_skills` section to register `.claude/skills/` and `.gemini/skills/` entries systematically | Low |
| A-05 | docs-writer | Low | Verify and synchronize CLAUDE.md §9 lifecycle table ↔ lifecycle-manager dispatch trigger (all 9 rows must match) | Low |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | `agents/lifecycle-manager.md` explicitly lists 8 domains | Manual review |
| C-02 | `agents/lifecycle-manager.md` jurisdiction includes `templates/common/` (L1) | Manual review |
| C-03 | `agents/lifecycle-manager.md` dispatch triggers include platform command/skill changes | Manual review |
| C-04 | `templates/common/agents/lifecycle-manager.md` lists Platform Command and Platform Skill domains | Manual review |
| C-05 | AGENTS.md Phase 6 dispatch table includes `.claude/commands/`, `.gemini/commands/` changes | Manual review |
| C-06 | CLAUDE.md §9 table and lifecycle-manager dispatch triggers are fully synchronized | Count rows in both |
