# Meeting Transcript
**Date**: 2026-05-31
**Topic**: Adding Lifecycle Management Rules to CLAUDE.md and GEMINI.md
**Participants**: lifecycle-manager, docs-writer, auditor
**Rounds**: 2
**Language**: Korean (transcript saved in English)
**Status**: Complete

---

## Context

When Claude/Gemini receive direct work instructions without a meeting/PM workflow, they tend to neglect lifecycle management (version bumps, SCRIPTS.md updates, template layer sync). Adding explicit lifecycle rules to CLAUDE.md and GEMINI.md as trigger-based behavioral rules would serve as a preventive mechanism alongside the existing audit.ts enforcement.

---

## Transcript

**[lifecycle-manager]** (Round 1)

Three specific patterns of lifecycle neglect when AI receives direct instructions:

1. **Script modified but SCRIPTS.md version not bumped** — occurred today
2. **Template layer propagation skipped** — `scripts/` modified but `templates/common/scripts/` not synced — occurred today
3. **Agent/skill added but AGENTS.md not updated** — common without PM workflow

Adding a "Lifecycle Management Rules" section to CLAUDE.md/GEMINI.md as a checklist would help AI internalize these rules as a pre-commit checklist.

---

**[docs-writer]** (Round 1)

Proposed section structure for CLAUDE.md/GEMINI.md:

```markdown
### N. Lifecycle Management Rules

After ANY file creation or modification, check the following before committing:

#### Scripts (`scripts/`, `templates/common/scripts/`)
- [ ] Bump `@version` in modified `.ts` file header
- [ ] Update version entry in `scripts/SCRIPTS.md`
- [ ] Run `bun scripts/lifecycle-sync-audit.ts` to verify sync

#### Agents (`agents/`)
- [ ] Update `AGENTS.md` roster if agent added/removed
- [ ] Run `bun run agent:verify`

#### Skills (`skills/`, `.claude/skills/`)
- [ ] Update `AGENTS.md § Skills` if skill added/removed
- [ ] Run `bun scripts/skill-lifecycle-audit.ts`

> Full rules: [CONSTITUTION.md §5.6], [§6], [§6.5]
```

Checklist format is key — AI follows checklists more reliably than prose rules.

---

**[auditor]** (Round 1)

Limitation of checklists: AI may skip them during fast, single-instruction tasks when context is narrow.

Stronger pattern — **trigger-based table** instead of checklist:

```markdown
| If you modify... | You MUST also... |
|-----------------|-----------------|
| `scripts/*.ts` | Bump `@version` + update `scripts/SCRIPTS.md` version entry |
| `scripts/*.ts` | Copy to `templates/common/scripts/` (or run publish-to-template) |
| `agents/*.md` | Update `AGENTS.md` roster table |
| `skills/*/SKILL.md` | Update `AGENTS.md § Skills` table |
| Any of the above | Run `bun scripts/audit.ts` before committing |
```

Trigger table allows AI to map "what file am I modifying?" → "what must I do?" more precisely than a checklist.

Also: CLAUDE.md and GEMINI.md must have identical content for this section — divergence causes confusion.

---

**[lifecycle-manager]** (Round 2)

Endorses trigger table approach. Adds "stop if unsure" principle:

```markdown
> ⚠️ If unsure whether a change requires lifecycle updates, run `bun scripts/audit.ts`
> and `bun scripts/lifecycle-sync-audit.ts` before proceeding. Do NOT skip.
```

Also: `templates/co-develop/CLAUDE.md` needs the same section — scaffolded projects should follow identical rules.

---

**[docs-writer]** (Round 2)

Final section structure (integrating both inputs):

```markdown
### N. Lifecycle Management Rules

> ⚠️ If unsure whether a change requires lifecycle updates, run `bun scripts/audit.ts`
> before committing. Do NOT skip this step.

When modifying files, apply the following rules **before** running `/sync` or committing:

| Modified file(s) | Required follow-up actions |
|-----------------|---------------------------|
| `scripts/*.ts` | 1. Bump `@version` in file header  2. Update version in `scripts/SCRIPTS.md`  3. Copy to `templates/common/scripts/` |
| `agents/*.md` | Update `AGENTS.md` roster table (`bun run agent:verify` to check) |
| `skills/*/SKILL.md` or `.claude/skills/*/SKILL.md` | Update `AGENTS.md § Skills` table |
| `templates/common/scripts/*.ts` | Update `templates/common/scripts/SCRIPTS.md` version entry |

Verification command (run after any of the above):
  bun scripts/audit.ts
  bun scripts/lifecycle-sync-audit.ts   # (once implemented)

> Full rules: §5.6 Agent Lifecycle · §6 Skill Lifecycle · §6.5 Script Lifecycle
```

Placement: Insert as new `### 8. Lifecycle Management Rules` before existing `### 8. Custom Command Error Recovery` (renumber 8→9, 9→10).

---

**[auditor]** (Synthesis)

### Points of Agreement

- **Trigger table format** adopted over checklist
- **Section title**: `Lifecycle Management Rules`
- **Structure**: warning note → trigger table → verification commands → CONSTITUTION links
- **Target files**: `CLAUDE.md`, `GEMINI.md`, `templates/co-develop/CLAUDE.md` (3 files)
- **Placement**: before existing `Custom Command Error Recovery` section

### Open Question

- `lifecycle-sync-audit.ts` not yet implemented — mark as `(coming soon)` in the section, or add after implementation. Decision needed before writing.

### Action Items

| # | Owner | Tier | Deliverable | Phase |
|---|-------|------|-------------|-------|
| A-01 | docs-writer | Low | Add `Lifecycle Management Rules` section to `CLAUDE.md` | Phase 1 |
| A-02 | docs-writer | Low | Add identical section to `GEMINI.md` (platform command adjustments) | Phase 1, parallel with A-01 |
| A-03 | docs-writer | Low | Add identical section to `templates/co-develop/CLAUDE.md` | Phase 1, parallel with A-01 |
| A-04 | auditor | Medium | Full audit + command parity verification | After A-01~A-03 |

## Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| C-01 | All 3 files have `Lifecycle Management Rules` section with trigger table | File inspection |
| C-02 | `bun scripts/audit.ts` passes after edits | Run audit |
| C-03 | Command parity: `.claude/commands/` and `.gemini/commands/` still match | Audit parity check |
| C-04 | Section is placed consistently in all 3 files | Manual review |
