# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Cross-Variant Workflow Contamination and New-Project Scaffolding Defect Diagnosis
**Participants**: architect, scaffolding-expert, automation-engineer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Transcript

**[Architect]**: (Round 1)

Analysis of the codebase reveals problems at two layers.

**Layer 1 — Scaffolding default contamination**: `new-project.ps1` line 5 hardcodes `$Variant = "co-develop"`. If the `/new-project` slash command does not pass a variant argument, co-develop is always used. The command file's argument passing behavior determines whether users get the correct variant.

**Layer 2 — CLAUDE.md §5 Specialist Agent List not split by variant**: co-work and co-design `CLAUDE.md` files both have identical §5 content:
```
- architect (Phase 1-2)
- automation-engineer (Phase 4)
- docs-writer (Phase 4)
- security-expert (Phase 5)
- lifecycle-manager (Phase 6)
```
This is the workspace-root common agent list. In co-design projects, `ux-researcher`, `design-lead`, `visual-designer`, and `prototype-engineer` are the Phase 4 agents, but CLAUDE.md instructs PM to dispatch `automation-engineer` and `docs-writer` — causing incorrect agent dispatch in generated projects.

Asked Scaffolding Expert whether the `variant.json` `agent_overrides` VARIANT-SECTION substitution is actually working.

---

**[Scaffolding Expert]**: (Round 1)

Confirmed the VARIANT-SECTION substitution mechanism requires `<!-- VARIANT-SECTION -->` markers in the skeleton file (`templates/common/agents/pm.md`). Inspection reveals these markers are absent from the common pm.md. Result: **the additive `agent_overrides` declared in variant.json are effectively nullified**.

The 3.6 step substitution regex fires but finds no markers, so the skeleton is output unchanged. The co-work/co-design/co-security variant `agents/pm.md` files exist in their respective template directories, but without `extends:` pattern or VARIANT-SECTION markers, the **common pm.md is the final output** in generated projects.

Asked Automation Engineer whether a generated co-work or co-design project's `agents/pm.md` actually contains the co-develop Agent Roster.

---

**[Automation Engineer]**: (Round 1)

Three problem areas isolated:

1. **CLAUDE.md §5 Specialist Agent List**: co-work, co-design, co-security all use identical common agent lists → variant-specific agents missing from PM dispatch guidance
2. **AGENTS.md PM Specialist Agent Roster vs Subagent Roster mismatch** (co-design): The PM Specialist Agent Roster lists common agents, while the Subagent Roster lists `ux-researcher`, `visual-designer`, etc. Two tables point to different agents.
3. **co-work AGENTS.md dual Workflow tables**: "Collaboration Workflow (7 Phases)" section and the top-level "Phase Summary" define different phase names and lead agents — contradictory.

Asked Auditor which of the three has the greatest runtime impact.

---

**[Auditor]**: (Round 1)

Runtime impact ranking:

**Rank 1 — Missing VARIANT-SECTION markers (scaffolding-time defect)**: pm.md is locked into the common version at project creation. Hard to fix post-creation. Affects all generated projects — root contamination.

**Rank 2 — CLAUDE.md §5 wrong agent list (session-start misdirection)**: PM reads CLAUDE.md on session start and dispatches `architect` instead of `design-lead` in a co-design project. Direct incorrect behavior.

**Rank 3 — AGENTS.md dual Workflow tables (documentation confusion)**: Creates confusion when PM references AGENTS.md but lower direct runtime impact.

**New finding**: Step 5.6b of `new-project.ps1` runs `inject-skills.ts` to inject AGENTS.md Skills into context.md. Unclear whether this correctly injects variant-specific skills (e.g., `ui-ux-design-intelligence` for co-design) or only common skills.

---

**[Architect]**: (Round 2)

Two solution paths for VARIANT-SECTION:

- **Option A**: Insert VARIANT-SECTION markers into `templates/common/agents/pm.md`. Immediate effect on all variants but adds complexity to the common file.
- **Option B**: Convert each variant's `agents/pm.md` to use `extends: ../../common/agents/pm.md` with frontmatter merge. Consistent with existing extends pattern in the codebase. Preferred.

For CLAUDE.md §5 split: CLAUDE.md does not support the extends/VARIANT-SECTION mechanism (that is agent-file-only). Each variant's CLAUDE.md §5 must be directly modified to list variant-appropriate agents.

Asked Scaffolding Expert whether the `/new-project` command file passes variant correctly.

---

**[Scaffolding Expert]**: (Round 2)

The CLAUDE.md §2 definition shows:
```
/new-project "name" → .\scripts\new-project.ps1 "$ARGUMENTS"
```

If `$ARGUMENTS` passes the full user input, the user must type `/new-project my-app -variant co-design` explicitly. Without this, the script defaults to co-develop silently. No AI-side variant selection logic exists in the current command file.

**Short-term**: Add variant selection prompt logic to the `/new-project` command file — AI asks user to choose variant before running the script.

**Mid-term**: Change `new-project.ps1` default from `co-develop` to empty string; error on missing variant or trigger interactive selection.

Asked Automation Engineer for the most efficient method to split CLAUDE.md §5 by variant.

---

**[Automation Engineer]**: (Round 2)

Recommended approach: **directly edit each variant's CLAUDE.md §5 Specialist Agent List** in place. The extends/VARIANT-SECTION mechanism doesn't apply to CLAUDE.md files.

Key edits:
- `co-design/CLAUDE.md §5`: replace architect → design-lead, automation-engineer → prototype-engineer
- `co-work/CLAUDE.md §5`: replace architect → analyst, automation-engineer → content-writer
- `co-security/CLAUDE.md §5`: follow yesterday's meeting A-01~A-05 action items

Also update `validate-templates.ts` to allow these variant-specific differences without triggering P-01 platform parity failures.

---

**[Auditor]**: (Synthesis)

**Root Causes Confirmed:**

**RC-1 (Scaffolding)**: No VARIANT-SECTION markers in `templates/common/agents/pm.md`. The `agent_overrides` additive substitution is a no-op. Generated projects receive the common Agent Roster regardless of variant.

**RC-2 (CLAUDE.md)**: All variant CLAUDE.md files have identical §5 Specialist Agent List (workspace-common agents). Variant-specific agents are not reflected in PM dispatch guidance.

**RC-3 (new-project default)**: `new-project.ps1` defaults to `co-develop`. The `/new-project` slash command has no variant selection prompt. Silent default to co-develop on every unqualified call.

**Points of Agreement:**
1. extends pattern preferred over VARIANT-SECTION markers for pm.md fix
2. Direct edit of each variant CLAUDE.md §5 is the feasible short-term fix
3. `/new-project` command needs variant selection logic

**Open Questions:**
- Whether `inject-skills.ts` correctly injects variant-specific skills (unconfirmed)
- Whether co-work AGENTS.md dual Workflow tables should be merged or one removed

---

## Action Items

| # | Owner | Tier | Deliverable | Priority |
|---|-------|------|-------------|----------|
| A-01 | automation-engineer | Medium | Update `co-design/CLAUDE.md §5` — replace Specialist Agent List with variant agents (design-lead, ux-researcher, prototype-engineer, visual-designer) | High |
| A-02 | automation-engineer | Medium | Update `co-work/CLAUDE.md §5` — replace with (analyst, content-writer, technical-writer, ms365-expert, project-coordinator) | High |
| A-03 | automation-engineer | Medium | Update `co-security/CLAUDE.md §5` — follow yesterday's meeting action items | High |
| A-04 | scaffolding-expert | High | Add VARIANT-SECTION markers to `templates/common/agents/pm.md` OR convert each variant pm.md to extends pattern — choose and implement | High |
| A-05 | automation-engineer | Low | Update `.claude/commands/new-project.md` — add variant selection prompt when variant not specified | Medium |
| A-06 | docs-writer | Low | Clean up co-work AGENTS.md — remove or merge "Collaboration Workflow (7 Phases)" section with Phase Summary | Medium |
| A-07 | automation-engineer | Low | Verify `inject-skills.ts` — confirm variant-specific skills are correctly injected into context.md; fix if not | Medium |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | Generated co-design project `agents/pm.md` contains design-lead, ux-researcher in Agent Roster | Scaffold test project, grep pm.md |
| C-02 | co-design/CLAUDE.md §5 lists design-specific agents | Manual review |
| C-03 | co-work/CLAUDE.md §5 lists collaboration-specific agents | Manual review |
| C-04 | `/new-project` without variant prompts user for selection | Test command invocation |
| C-05 | co-work AGENTS.md has single consistent workflow table | Manual review |
| C-06 | validate-templates.ts passes with variant-specific CLAUDE.md §5 differences | bun scripts/validate-templates.ts |
