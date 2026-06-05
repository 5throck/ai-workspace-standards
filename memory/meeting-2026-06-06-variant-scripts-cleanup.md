# Meeting Transcript
**Date**: 2026-06-06
**Topic**: Variant scripts/ directory cleanup — duplicate and outdated file handling
**Participants**: architect, auditor, automation-engineer, lifecycle-manager
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Background

Investigation of templates/co-develop/scripts/ revealed:
- 37 files identical to templates/common/scripts/ (pure duplicates)
- 4 files DIFFERS: variant has OLDER versions than common (regression bug — variant overwrites newer common version during scaffold overlay)
- 5 files ONLY_VARIANT: L0-only script leaks (already identified)

new-project.sh overlay mechanism:
1. cp -r templates/common/ → project/ (copy all common)
2. find templates/co-*/ overlay files → project/ (overwrite with variant)

Result: variant scripts/ DIFFERS files are regression bugs — older variant versions overwrite newer common versions during new project scaffold.

DIFFERS detail:
- agent-verify.ts: L0=v1.0.1 (has verifySharedBlocks()), variant=v1.0.0 (missing function)
- lifecycle-sync-audit.ts: CRLF vs LF only (content identical)
- verify-readme-sync.ts: L0=dynamic variant detection, variant=hardcoded list
- verify-scripts.ts: L0=new `layer` column schema, variant=old `drift` column schema

---

## Transcript

### Round 1

**architect** (Round 1):
Identified the overlay pattern and confirmed variant scripts/ should only contain genuinely different variant-specific overrides. No such files exist currently. Concluded: empty all templates/co-*/scripts/ directories. new-project.sh handles missing scripts/ gracefully. Asked automation-engineer about CRLF fix options and cross-variant verification.

**automation-engineer** (Round 1):
Confirmed CRLF is handled by .gitattributes and removing the file solves it. All other variants have the same pattern (created at same time, same method). Proposed 3-step deletion: L0-only (5) + identical (37) + DIFFERS (4) = all files gone. Asked lifecycle-manager whether validate-templates.ts requires specific scripts in variant scripts/.

**lifecycle-manager** (Round 1):
Confirmed validate-templates.ts Check 10 compares L0 vs L1 only (not variant scripts/). L2 variant integrity check requires variant.json, CLAUDE.md, GEMINI.md, agents/ — NOT specific scripts files. Emptying scripts/ will not break validation. Noted lib/, hooks/, helpers/ subdirectories (added in B-01) also need cleanup. Asked auditor about git tracking of empty directory.

**auditor** (Round 1):
Confirmed git does not track empty directories — scripts/ will simply disappear, which is correct. new-project.sh find command handles missing scripts/ dir gracefully. Proposed broader audit: agents/ and skills/ may have similar duplication. Proposed adding validate-templates.ts check: WARN if variant scripts/ file is identical to common (prevent future re-accumulation).

---

### Round 2

**automation-engineer** (Round 2):
Confirmed `git rm -r templates/co-*/scripts/` single command handles all files. No .gitkeep needed. Noted agents/ has intentional delta (variant-specific pm.md overrides). Skills/ — asked lifecycle-manager to verify variant-specific skills.

**lifecycle-manager** (Round 2):
Confirmed templates/co-*/skills/ has NO variant-specific skills — all were copied from common in B-01. Safe to empty. Defined correct variant template structure (delta-only):
- variant.json, CLAUDE.md, GEMINI.md, AGENTS.md (variant-specific)
- agents/pm.md (variant-specific override)
- .claude/commands/ variant-specific commands only (e.g. security-check.md)
- No scripts/ or skills/ (provided from common at scaffold time)

**auditor** (Synthesis):
See Action Items.

---

## Decisions

| Item | Decision |
|------|----------|
| templates/co-*/scripts/ | Empty entirely — git rm -r. All 46 files are either duplicates, outdated, or L0-only leaks |
| templates/co-*/skills/ | Empty entirely — git rm -r. All skills are common_skills from B-01, no variant-specific |
| Correct variant template structure | Delta-only: variant.json, CLAUDE.md, GEMINI.md, AGENTS.md, agents/pm.md, variant .claude/commands/ only |
| DIFFERS 4 files | Delete — scaffold will use newer common versions |
| .gitkeep | Not needed — new-project.sh does not require scripts/ directory |
| validate-templates.ts addition | Add WARN check: variant scripts/ file identical to common = redundant copy |

---

## Action Items

| # | Owner | Tier | Deliverable | Platform | Phase |
|---|-------|------|-------------|----------|-------|
| F-01 | automation-engineer | Low | `git rm -r templates/co-*/scripts/` — empty all 5 variant scripts/ directories | L0-only | 4 |
| F-02 | automation-engineer | Low | `git rm -r templates/co-*/skills/` — empty all 5 variant skills/ directories | L0-only | 4 |
| F-03 | automation-engineer | Low | `validate-templates.ts` — add WARN check for variant scripts/ files identical to common | L0-only | 4 |
| F-04 | lifecycle-manager | Medium | Update common.lifecycle.json + VERSION_REGISTRY.json to record delta-only structure transition | L0-only | 6 |
