# Meeting Transcript
**Date**: 2026-05-29
**Topic**: Pre-execution conflict and dependency analysis for N/T/C/R task series
**Participants**: pm, architect, auditor, automation-engineer
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

Four task series were identified for execution:
- **N**: Meeting skill restructure (Archive/Close step split) + PM execution plan table enforcement
- **T**: templates/common contamination cleanup (CONSTITUTION.md, CLAUDE.md, GEMINI.md delete + validate-templates Check 0)
- **C**: .claude/.gemini commands asymmetry fix (move shared commands to common/, leave only security-check in variants)
- **R**: README.md placeholder format fix ({{PROJECT_NAME}} → [Project Name])

---

## Transcript

### Round 1 — Conflict Identification

**Architect**: (Round 1)

Three file-level conflict points:

**Conflict D-1 (N-04 vs T-02)**: N-04 adds execution plan rule to `templates/common/CLAUDE.md` and `GEMINI.md`. T-02 **deletes** those same files. If N-04 runs first, work is wasted and the intermediate state has wrong-content files with rule additions. T-02 must run before N-04.

**Conflict D-2 (C series vs validate-templates Check 6)**: Check 6 currently verifies (a) common/.claude/commands/ has 4 shared commands, and (b) each variant/.claude/commands/ has meeting.md. C-03 removes meeting.md from variants. This immediately fails Check 6(b) at pre-commit. C series and Check 6 logic update must be in the same commit.

**Conflict D-3 (C series vs variant-contract.json)**: variant-contract.json required list includes .gemini/commands/*.md in variants. C-04 removes these. validate-templates contract check fails for all variants. variant-contract.json update and C-04 must be in the same commit.

---

**Auditor**: (Round 1)

Additional conflict discovered:

**Conflict D-4 (T-02 vs T-04)**: T-04 adds Check 0 which detects forbidden files in templates/common/ (including CLAUDE.md, GEMINI.md). If T-04 is committed before T-02, Check 0 immediately fires on the existing CLAUDE.md/GEMINI.md and blocks all further commits. T-02 and T-04 must be in the same atomic commit.

Also: C series breaks Check 8 (meeting.md sync check between workspace root .claude/commands/ and templates/co-develop/.claude/commands/). After C-03, co-develop/.claude/commands/meeting.md is deleted, breaking Check 8's reference path. Check 8 must also be updated in Group 4.

---

**Automation-engineer**: (Round 1)

File conflict matrix (which series touches which files):

| File | N | T | C | R |
|------|---|---|---|---|
| templates/common/CLAUDE.md | N-04 add | T-02 DELETE | — | — |
| templates/common/GEMINI.md | N-04 add | T-02 DELETE | — | — |
| validate-templates.ts | — | T-04 Check 0 | Check 6+8 update | — |
| variant-contract.json | — | — | .gemini required update | — |
| common/.claude/commands/ | — | — | meeting.md add | — |
| common/.gemini/commands/ | — | — | 4 files add | — |
| variant .claude/commands/ | — | — | 4+meeting delete | — |
| variant .gemini/commands/ | — | — | 4 delete | — |
| SKILL.md (meeting-facilitation) | N-01 | — | — | — |
| agents/pm.md | N-03 | — | — | — |
| CLAUDE.md (L0) | N-04 | — | — | — |
| GEMINI.md (L0) | N-04 | — | — | — |
| README.md (common) | — | — | — | R-01 |

Atomic groupings derived from matrix:
- **Group 2 (atomic)**: T-02 + T-04
- **Group 4 (atomic)**: All C items + Check 6 update + Check 8 update + variant-contract.json update

---

### Round 2 — Execution Order Design

**Architect**: (Round 2)

Five execution groups:

```
Group 1 (parallel, independent)
  T-01: Delete CONSTITUTION.md
  T-03: Add Blocklist section to variant-contract.md
  N-01: SKILL.md Step 6/7 split
  R-01: Fix README.md placeholder format

Group 2 (atomic commit — validate-templates.ts modified)
  T-02: Delete common/CLAUDE.md + GEMINI.md
  T-04: Add Check 0 to validate-templates.ts

Group 3 (after Group 2)
  N-03: agents/pm.md execution plan rule
  N-04: L0 CLAUDE.md + GEMINI.md execution plan rule

Group 4 (atomic commit — validate-templates.ts + variant-contract.json modified)
  C-01~C-05: Move commands files (common ↔ variant)
  Check 6 update: validate variant meeting.md from common, not variant
  Check 8 update: update meeting.md sync reference path
  variant-contract.json: update .gemini/commands required list

Group 5 (sequential, after all groups)
  N-02: sync-skills.ts
  N-05: bun run audit
  T-05/C-07: bun run validate-templates
```

Group 2 and Group 4 are independent but both modify validate-templates.ts → sequential execution required to prevent edit conflicts.

---

**Auditor**: (Round 2)

N-02 must run before N-05 (audit): without syncing SKILL.md to .claude/skills/, audit may report skill inconsistency warning. Correct order in Group 5: N-02 → N-05 → T-05/C-07.

---

## Conflicts Found

| ID | Conflict | Risk | Resolution |
|----|----------|------|------------|
| D-1 | N-04 vs T-02 | Adding content to files that will be deleted | T-02 before N-04 (Group 2 before Group 3) |
| D-2 | C series vs Check 6 | Structure change breaks validation immediately | Atomic Group 4 |
| D-3 | C series vs variant-contract.json | Required files missing in variants | Atomic Group 4 |
| D-4 | T-02 vs T-04 | Check 0 self-blocks before deletion | Atomic Group 2 |
| D-5 | C series vs Check 8 | meeting.md sync reference broken | Include Check 8 update in Group 4 |

## Final Execution Order

```
Group 1 (parallel): T-01, T-03, N-01, R-01
Group 2 (atomic):   T-02 + T-04
Group 3 (after 2):  N-03, N-04
Group 4 (atomic):   C-01~C-05 + Check 6 update + Check 8 update + variant-contract.json
Group 5 (sequential after all): N-02 → N-05 → T-05/C-07
```

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | Group 2 is a single commit (T-02 + T-04 together) | git log --oneline |
| AC-02 | Group 4 is a single commit (all C items + Check 6/8 + contract) | git log --oneline |
| AC-03 | N-04 runs after T-02 (no editing files that will be deleted) | Task order |
| AC-04 | bun run audit passes after Group 5 | Script output |
| AC-05 | bun run validate-templates passes after Group 5 | Script output |
