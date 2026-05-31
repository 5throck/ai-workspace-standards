# Meeting Transcript
**Date**: 2026-06-01
**Topic**: Project work artifact default location policy — preventing root-level file creation, routing to docs/memory
**Participants**: architect, pm, docs-writer
**Rounds**: 3
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Problem Statement

When AI agents create files in a newly scaffolded project (e.g., co-work variant), outputs default to the project root directory. The user wants artifacts to go to `docs/` or `memory/` by default, across all variants.

---

## Transcript

### architect (Round 1)
Defined the structural problem: AI agents default to CWD (project root) when no output path is specified — this is default behavior, not a bug. Solution: embed explicit policy in documents that agents read at session start. Priority locations: `docs/context.md` (read every session) and `agents/pm.md` (referenced by PM every session). Proposed file-type routing: analysis/research → docs/, session logs/meeting transcripts → memory/, final deliverables → docs/, temp/WIP → docs/drafts/, config files → root allowed. Posed question about whether policy should differ per variant.

### docs-writer (Round 1)
Confirmed variant differences matter. co-work (document/collaboration focus) needs docs/reports/, docs/drafts/, docs/published/. co-develop (software focus) already uses docs/adr/, docs/specs/ by convention; root is acceptable for code files. co-security needs stricter policy because sensitive findings at root risk accidental commit. co-design needs docs/designs/, docs/specs/. Proposed universal rule: no .md file creation at root (except standard files: README.md, CHANGELOG.md, AGENTS.md, SECURITY.md, CONSTITUTION.md, CLAUDE.md, GEMINI.md). Asked PM how to enforce this in agent dispatch.

### pm (Round 1)
Enforcement approach: add explicit path specification rule to pm.md ("when directing file creation, always specify output path; default to docs/ if unknown; root .md creation prohibited except standard files"). But PM rule alone is insufficient because specialist agents may create files autonomously without PM intermediation. Solution: add universal rule to docs/context.md ## Coding Guidelines (or new ## File Organization Policy section) — this is read by all agents at session start. Also add one line to AGENTS.md Universal Baseline Behaviors. Asked architect about propagation mechanism.

### architect (Round 2)
Confirmed propagation: templates/common/docs/context.md is the SSOT; variant docs/<variant>.context.md extends it. Changes to common propagate to all variants automatically. Recommended 3-location simultaneous update: (1) templates/common/docs/context.md — add ## File Organization Policy, (2) templates/common/agents/pm.md — add path specification rule, (3) AGENTS.md Universal Baseline — one line. Variant-specific folder structures (co-work docs/reports/, co-security docs/threat-models/) belong in each variant's docs/<variant>.context.md.

### docs-writer (Round 2)
Provided variant-specific folder structures: co-work (docs/reports/, docs/drafts/, docs/research/, memory/), co-develop (docs/adr/, docs/specs/, docs/api/), co-security (docs/reports/, docs/threat-models/, docs/findings/ — sensitive files should be .gitignore'd), co-design (docs/designs/, docs/specs/, docs/prototypes/). Key insight: pre-creating these subdirectories with .gitkeep during scaffolding makes agents naturally select correct paths — structure-driven behavior rather than rule-driven. This is more reliable than text instructions alone.

### pm (Round 2)
Endorsed pre-creation of directories as the strongest enforcement mechanism. Agents choose existing paths over creating new ones. Prioritized: (1) common policy in context.md + pm.md + AGENTS.md immediately; (2) variant-specific folder structures + pre-created directories per variant. Proposed adding audit.ts check: detect non-standard .md files at project root (L2-only check). Asked architect if technically feasible.

### architect (Round 3)
Confirmed audit.ts check is feasible and appropriate. Pattern already exists (stray test artifacts check). New check: "non-standard .md files at root" — only runs when docs/context.md is present (L2 project context). Workspace root (L0) is exempt since it legitimately has many root .md files. Finalized 3-layer solution: Rules (context.md + pm.md + AGENTS.md) + Structure (pre-created directories) + Detection (audit.ts check).

### docs-writer (Synthesis)
Three-layer solution: Rules (explicit policy in multiple agent-read documents) + Structure (pre-created subdirectories) + Detection (audit.ts). Universal routing table: analysis/research → docs/, deliverables → docs/, session logs/meetings → memory/, WIP/drafts → docs/drafts/, config files → root allowed, standard root files → root allowed.

---

## Action Items

| # | Owner | Tier | Deliverable |
|---|-------|------|-------------|
| D-01 | PM | High | `templates/common/docs/context.md`: add `## File Organization Policy` section |
| D-02 | PM | High | `templates/common/agents/pm.md`: add file creation path specification rule |
| D-03 | PM | Medium | `AGENTS.md` Universal Baseline: add root .md prohibition line + propagate to workspace root |
| D-04 | PM | Medium | `scripts/audit.ts`: add L2-only check for non-standard .md files at project root |
| D-05 | PM | Medium | Each variant `docs/<variant>.context.md`: add variant-specific recommended folder structure |
| D-06 | PM | Low | Pre-create subdirectories with .gitkeep in each variant template: co-work (reports/drafts/research), co-develop (adr/specs), co-security (reports/threat-models/findings), co-design (designs/specs) |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | New co-work project: agent creates analysis file in docs/, not root | Manual test |
| AC-02 | audit.ts fails when non-standard .md appears at project root | Run audit in project with stray root .md |
| AC-03 | Variant-specific subdirectories exist after scaffolding | Check docs/ structure in new project |
