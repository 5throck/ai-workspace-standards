# Meeting Transcript
**Date**: 2026-05-30
**Topic**: Workspace Review Skill Design — Trigger Conditions, Scope, Platform Compatibility
**Participants**: PM, Architect, Auditor, Lifecycle Manager
**Rounds**: 2
**Orchestrator**: PM
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Agenda

1. Round 1: Skill scope and architecture — what does the skill do and where does it live?
2. Round 2: Trigger conditions and platform compatibility

---

## Round 1: Skill Architecture

**PM**: (Round 1 — Open)

We need to design a `workspace-review` skill that automates the 7-agent parallel review workflow performed manually today. Architect, define the skill's scope, structure, and execution model. Lifecycle Manager, advise on platform compatibility requirements.

---

**Architect**: (Round 1)

The skill must work in three execution contexts:
1. Workspace root (this repository)
2. Individual variant templates (co-design, co-develop, co-work, co-security)
3. Scaffolded projects created from templates

The core challenge is that each context has a different agent roster. The skill must auto-detect available agents from the local `agents/` directory rather than hardcoding a list. This makes it portable.

Execution model: the skill provides the PM with structured review criteria per domain. The PM then dispatches available agents in parallel per the 7-domain framework (architecture, standards, automation, documentation, security, lifecycle, scaffolding). The skill does not dispatch agents itself — it instructs the PM how to dispatch them.

This design works in Claude Code (Agent tool), Antigravity (run_agent or inline roleplay), and any future platform because the skill content is platform-neutral instructions.

---

**Lifecycle Manager**: (Round 1)

For platform compatibility, the skill file must have a `## Platform Execution` section that explicitly documents:
- Claude Code: use the `Agent` tool with `run_in_background: true` for parallel execution
- Antigravity/Gemini CLI: use `run_agent` tool or inline meeting roleplay via `/meeting --dialogue`

The skill frontmatter must not include any Claude-only fields. Standard fields only: `name`, `status`, `description`, `owner`, `version`, `last_reviewed`.

For template distribution: the skill goes in `skills/workspace-review/` at L0, syncs to `.claude/skills/` and `.gemini/skills/` via `sync-skills.ts`, and is included in `templates/common/skills/` for project distribution.

---

**PM**: (Round 1 — Close)

Agreed: the skill is a structured PM instruction set, not an automation script. It auto-detects agents, provides domain review criteria, and has platform-specific execution sections. Distribution follows the standard L0 → .claude/skills/ → .gemini/skills/ → templates/common/skills/ chain.

---

## Round 2: Trigger Conditions and QA Escalation

**PM**: (Round 2 — Open)

Auditor, define the QA escalation trigger (T-03). Architect, define what structural changes should trigger PM's autonomous judgment (T-02). Lifecycle Manager, confirm what changes to pm.md and auditor.md are needed.

---

**Auditor**: (Round 2)

T-03 QA Escalation trigger conditions (any one is sufficient):
1. `bun scripts/audit.ts` exits with 3 or more ERROR-level failures
2. `bun scripts/validate-templates.ts` exits with 2 or more ERROR-level failures
3. security-expert finds a Critical-severity finding during any security review

When triggered, auditor adds the following to its next PM report:
```
⚠️ QA ESCALATION: [N] Critical issues detected.
Recommending PM to invoke /workspace-review skill.
Trigger: audit.ts ERRORs=[N] / validate-templates ERRORs=[N] / security Critical=[N]
```

PM is not required to accept the escalation — it is a recommendation. PM documents the decision to accept or defer.

The escalation language should be added to `agents/auditor.md` in the Responsibilities section.

---

**Architect**: (Round 2)

T-02 PM autonomous judgment trigger conditions:
- 3 or more agent files modified in a single session
- Any change to phase numbering or PM-owned phase declarations
- New variant added or variant status promoted (beta → stable)
- `workspace-schema.json` modified

These are structural changes that cross-cut multiple documents. The PM should run workspace-review proactively when these occur, before committing, not after. Add this to `agents/pm.md` under a "Proactive Review Triggers" section.

---

**Lifecycle Manager**: (Round 2)

Both pm.md and auditor.md changes are minimal — one new section each. The skill itself is the heavier work.

One important note on new project scaffolding: `new-project.sh` copies `templates/common/skills/` to the new project. If `workspace-review` is in `templates/common/skills/`, it will be included in every scaffolded project automatically. No changes to `new-project.sh` needed.

---

**PM**: (Round 2 — Close)

All design decisions confirmed. Five action items assigned. The open question about new-project scaffolding is resolved: Lifecycle Manager confirmed the skill will auto-propagate through the existing `templates/common/skills/` copy mechanism.

---

## Action Items

| # | Owner | Deliverable | Priority |
|---|-------|-------------|----------|
| A-01 | automation-engineer + lifecycle-manager | Create `skills/workspace-review/SKILL.md` with 7-domain review framework, platform execution section, and trigger condition documentation | Immediate |
| A-02 | automation-engineer | Add T-02 Proactive Review Triggers section to `agents/pm.md` | After A-01 |
| A-03 | auditor | Add T-03 QA Escalation procedure to `agents/auditor.md` | After A-01 |
| A-04 | lifecycle-manager | Sync workspace-review skill to `.claude/skills/`, `.gemini/skills/`, `templates/common/skills/` | After A-01 |
| A-05 | lifecycle-manager | Register workspace-review in `AGENTS.md` Skills table | After A-04 |

## Open Questions

- None (new-project scaffolding resolved: templates/common/skills/ auto-propagates)

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| AC-01 | `skills/workspace-review/SKILL.md` exists with 7-domain review criteria and platform execution section | File present, all 7 domains documented |
| AC-02 | `/workspace-review` triggers the skill in Claude Code | Test: type `/workspace-review` in Claude Code session |
| AC-03 | Skill works in a scaffolded project with different agent roster | Test: create new project, run skill, verify it uses local agents |
| AC-04 | `agents/pm.md` has T-02 Proactive Review Triggers | Section present with structural change conditions |
| AC-05 | `agents/auditor.md` has T-03 QA Escalation procedure | Section present with escalation format and threshold |
| AC-06 | `.gemini/skills/workspace-review/SKILL.md` exists | File present for Antigravity compatibility |
