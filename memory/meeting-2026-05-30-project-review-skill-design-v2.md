# Meeting Transcript
**Date**: 2026-05-30
**Topic**: Project Review Skill — Name Revision, Scaffolding Verification, Design Advancement (Session 2)
**Participants**: PM, Architect, Auditor, Lifecycle Manager, Scaffolding Expert
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

1. Round 1: Skill naming problem and scaffolding inclusion verification
2. Round 2: Execution model advancement and updated action items

---

## Round 1: Naming and Scaffolding

**PM**: (Round 1 — Open)

Two issues raised since Session 1:
1. "workspace-review" feels wrong inside a scaffolded project — user confusion expected
2. Scaffolding inclusion needs verification, not assumption

Scaffolding Expert, verify whether skills in templates/common/skills/ actually reach new projects. Architect, propose alternative names.

---

**Scaffolding Expert**: (Round 1)

Verified new-project.sh logic: the script copies `templates/common/skills/` to the new project's `skills/` directory. However, `templates/common/skills/` is currently empty — each variant's skills live in `templates/co-xxx/skills/`. The assumption from Session 1 that the skill would "auto-propagate through templates/common/skills/" was incorrect.

The reliable approach is to place `project-review` directly in each variant's `skills/` directory (`templates/co-design/skills/`, `templates/co-develop/skills/`, etc.) so it is included when those variants are used as scaffolding sources.

For the workspace root, the skill lives in `skills/project-review/` and is not scaffolded — it belongs to the standards repository itself.

---

**Architect**: (Round 1)

Naming candidates reviewed:

| Name | Assessment |
|------|------------|
| `workspace-review` | Rejected — workspace-root-specific connotation |
| `project-health-check` | Passive connotation, health-check implies monitoring |
| `full-review` | Too vague about scope |
| `comprehensive-review` | Accurate but verbose |
| `project-review` | **Selected** — works naturally in all contexts: workspace root ("review this workspace"), variant project ("review this co-develop project"), scaffolded project ("review this project") |

---

**PM**: (Round 1 — Close)

Skill renamed to `project-review`. Scaffolding approach changed from templates/common reliance to direct inclusion in each variant's skills/ directory. Scaffolding Expert confirmed this is the reliable path.

---

## Round 2: Execution Model and Final Design

**PM**: (Round 2 — Open)

Architect, upgrade the execution model from passive (skill provides instructions to PM) to active (skill auto-detects context and generates execution plan). Auditor, confirm T-03 escalation format remains valid with new skill name.

---

**Architect**: (Round 2)

Enhanced execution flow:

**Step 1 — Context Detection**
Scan local `agents/` directory to get available agents. Read AGENTS.md or docs/context.md to determine project type. Output: "co-develop project, 8 agents available."

**Step 2 — Automatic Execution Plan Generation**
Map detected agents to review domains. Domains without a dedicated agent are covered by PM directly. Present execution plan table → user approval.

**Step 3 — Parallel Agent Dispatch (platform-specific)**
- Claude Code: `Agent` tool with `run_in_background: true`
- Antigravity/Gemini CLI: `/meeting --dialogue --agents [list]` inline roleplay

**Step 4 — Results Synthesis**
Output prioritized improvement table (Critical/High/Medium/Low). Auto-generate action items. If `--tasks` flag passed, call TaskCreate for each item.

**Trigger condition embedding in frontmatter description** (enables PM and auditor to auto-recognize when to invoke):
```yaml
description: >
  Performs a comprehensive parallel review of the current project using all
  available specialist agents. Produces a prioritized improvement plan.
  Use when: user requests a full project review; PM detects structural changes
  (3+ agent files modified, phase schema changes, new variant added);
  QA escalation from auditor (audit.ts ERROR >= 3 or security Critical finding).
```

---

**Auditor**: (Round 2)

T-03 escalation format updated for new skill name:

```
⚠️ QA ESCALATION: [N] Critical issues detected.
Recommending PM to invoke /project-review skill.
Trigger: audit.ts ERRORs=[N] / validate-templates ERRORs=[N] / security Critical=[N]
```

Threshold remains: audit.ts ERROR ≥ 3 OR security-expert Critical finding. PM decision to accept or defer is documented.

---

**Lifecycle Manager**: (Round 2)

Sync chain for `project-review`:
- L0 source: `skills/project-review/SKILL.md` (workspace root)
- Claude sync: `.claude/skills/project-review/SKILL.md`
- Gemini sync: `.gemini/skills/project-review/SKILL.md`
- Variant inclusion: `templates/co-*/skills/project-review/SKILL.md` (direct copy, not via sync-skills.ts which only handles workspace root skills)
- Future scaffolded projects: inherited from variant template at creation time

---

**PM**: (Round 2 — Close)

All design decisions finalized. Six action items assigned. The open question about new-project.sh skill copying is now A-06 and will be verified and fixed by Scaffolding Expert.

---

## Action Items

| # | Owner | Deliverable | Notes |
|---|-------|-------------|-------|
| A-01 | automation-engineer | Create `skills/project-review/SKILL.md` with context auto-detection, 7-domain framework, platform execution sections | Renamed from workspace-review; enhanced execution model |
| A-02 | automation-engineer | Add T-02 Proactive Review Triggers to `agents/pm.md` referencing `/project-review` | Updated skill name |
| A-03 | auditor | Add T-03 QA Escalation procedure to `agents/auditor.md` referencing `/project-review` | Updated skill name |
| A-04 | lifecycle-manager | Sync to `.claude/skills/`, `.gemini/skills/`; copy to all 4 `templates/co-*/skills/` directories | Direct variant inclusion |
| A-05 | lifecycle-manager | Register in workspace root `AGENTS.md` Skills table + all 4 `templates/co-*/AGENTS.md` | |
| A-06 | scaffolding-expert | Verify `new-project.sh`/`.ps1` copies variant skills/ correctly; fix if project-review is not propagated to scaffolded projects | New item from Session 2 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `skills/project-review/SKILL.md` exists with 7-domain criteria and platform execution section | File present |
| AC-02 | `/project-review` triggers correctly in Claude Code at workspace root | Test in session |
| AC-03 | Skill exists in all 4 variant templates | `ls templates/co-*/skills/project-review/` shows 4 results |
| AC-04 | Skill exists in `.claude/skills/` and `.gemini/skills/` | Both paths present |
| AC-05 | `agents/pm.md` has T-02 Proactive Review Triggers | Section present |
| AC-06 | `agents/auditor.md` has T-03 QA Escalation procedure | Section present with threshold and format |
| AC-07 | New project scaffolded from any variant includes project-review skill | Run new-project.sh, verify skills/project-review/ exists in output |
