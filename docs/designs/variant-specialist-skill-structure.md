# Variant Specialist Skill File Structure

> **Architect**: Canonical format specification for specialist skill files inside template variants
> **Status**: Active — Implemented
> **Created**: 2026-06-19
> **Last Updated**: 2026-06-19
> **Phase**: Reference Specification

---

## Executive Summary

This document defines the canonical format for specialist skill files located at
`templates/<variant>/skills/<slug>/SKILL.md`. It is the companion document to
[`variant-specialist-agent-structure.md`](variant-specialist-agent-structure.md)
and is enforced by Wave 1.5 (`normalize-agent-skills.ts`) and `audit.ts`.

---

## 1. Skill vs. Agent — Content Boundary

| Belongs in **Skill** (`SKILL.md`) | Belongs in **Agent** (`agents/<name>.md`) |
|-----------------------------------|------------------------------------------|
| Step-by-step execution procedure | Role declaration and PM-only gate |
| Output artifact templates | Phase ownership and handoff protocol |
| Tool invocation commands | Meeting participation character |
| Acceptance criteria for the stage | Dispatch protocol table |
| "When to use this skill" conditions | Agent-level constraints |

When an agent file contains step-by-step procedure sections (`## Step N`, `## 절차`, etc.),
those sections belong in a skill file. The agent should reference the skill:
`Full instructions: see skills/<slug>/SKILL.md`.

---

## 2. Canonical Frontmatter

```yaml
---
name: <skill-slug>        # kebab-case, matches directory name
description: >
  <What this skill does — one or two sentences.>
  <When to use it — trigger phrases in both languages if applicable.>
version: 1.0.0            # semver; bump on structural changes
status: active            # active | deprecated
owner: <agent-slug>       # agent responsible for invoking this skill
last_reviewed: YYYY-MM-DD # date of last content review
prerequisites: none       # or: list of other skill slugs that must run first
---
```

### Field Rules

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | Must match the directory name (e.g., `skills/lecture-research/` → `name: lecture-research`) |
| `description` | Yes | Block scalar (`>`); first sentence: what it does; second: when to use |
| `version` | Yes | semver — bump minor for new steps, patch for wording fixes |
| `status` | Yes | `active` for all deployed skills |
| `owner` | Yes | Kebab-case agent slug of the agent that invokes this skill |
| `last_reviewed` | Yes | ISO date; update whenever content changes significantly |
| `prerequisites` | Yes | `none` or comma-separated skill slugs |

---

## 3. Canonical Body Sections

Sections must appear in this order:

```markdown
## Context

One or two sentences: when and why this skill is invoked. Not a list — prose.
Reference the workflow stage (e.g., "Use at Stage 1 when…").

## When to Use

- Trigger condition 1 (English)
- Trigger condition 2 (Korean equivalent, if applicable)
- Condition based on file existence (e.g., "When X.md does not yet exist")

## Execution Steps

1. **Step Name**: What to do. Include sub-bullets for options or variants.
2. **Step Name**: ...
3. **Step Name**: ...

Keep steps imperative and concrete. Reference output file paths explicitly.

## Output Format

Description of the artifact(s) this skill produces:
- File path: `<project-root>/<artifact-path>`
- Structure: describe sections or format

Include a minimal template block when the output has a fixed structure.

## Related Skills

- `<slug>` — brief note on the relationship (e.g., "runs before this skill", "consumes output")
- `<slug>` — ...
```

---

## 4. Section-by-Section Rules

### `## Context`
- Must be prose (not a list).
- Must name the workflow stage or phase it belongs to.
- Must NOT duplicate the `description` frontmatter field verbatim.

### `## When to Use`
- Must include at least 2 trigger conditions.
- For skills used in Korean-language projects, include Korean trigger phrases.
- Must NOT use agent-phrasing like "PM dispatches at Stage N" — that belongs in the agent file.

### `## Execution Steps`
- Must use numbered list with bolded step names: `1. **Name**: …`
- Sub-steps use nested bullets.
- Must reference output file paths explicitly (e.g., `presentations/<project>/research_notes.md`).
- Must NOT include agent governance logic (gates, handoffs) — reference the agent file for those.

### `## Output Format`
- Must name the output artifact and its path.
- If the output has a fixed structure, include a minimal Markdown template block.
- May include a Korean example if the project is Korean-language.

### `## Related Skills`
- Must be present even if empty (use `<!-- none -->` if no related skills).
- List skills the user should run before or after this one.
- Use the skill slug, not a human-readable title.

---

## 5. Prohibited Patterns

The following patterns indicate content that should NOT be in a skill file:

| Pattern | Where it belongs instead |
|---------|--------------------------|
| `## Role` as first section | `## Context` (rename) |
| `## When to Invoke` | `## When to Use` (rename) |
| `## ⚠️ PM-ONLY INVOCATION` block | `agents/<name>.md` only |
| `## Meeting Participation` | `agents/<name>.md` only |
| `## Dispatch Protocol` table | `agents/<name>.md` only |
| Full instructions duplicated from agent | Reference only: `see agents/<name>.md` |

The `lecture-pm` anti-pattern: a skill file that summarizes PM orchestration logic and
then points back to `agents/pm.md` for the actual instructions. Skills must be self-contained
execution guides — they should not be summary cards of agent behavior.

---

## 6. `lecture-pm` Special Case

`templates/co-deck/skills/lecture-pm/SKILL.md` is a **PM Workflow Reference Card** —
a quick-reference summary for users of the lecture production pipeline. It is not a
traditional execution skill. Treat it as a **workflow reference** with this structure:

```markdown
## Context         — One sentence: what the PM orchestrates
## Workflow Stages — Table: Stage N | Agent | Gate | Output
## Quick Reference — Dispatch triggers (user phrases → PM action)
## Related Skills  — List of all lecture-* skills in order
```

This is the only valid exception to the standard 5-section structure.

---

## 7. Gold Standard References

| Variant | Example Skill |
|---------|--------------|
| co-consult | `templates/co-consult/skills/competitive-intelligence/SKILL.md` |
| co-security | `templates/co-security/skills/verify-authorization/SKILL.md` |
| co-deck | `templates/co-deck/skills/lecture-research/SKILL.md` (post-migration) |

---

## 8. Migration Checklist

Use when migrating pre-standard skill files or creating new skills:

- [ ] Frontmatter has all 7 required fields (`name`, `description`, `version`, `status`, `owner`, `last_reviewed`, `prerequisites`)
- [ ] `description` is a block scalar (`>`) with 2+ sentences
- [ ] Body sections in canonical order: Context → When to Use → Execution Steps → Output Format → Related Skills
- [ ] `## Context` is prose (not a list), references the workflow stage
- [ ] `## When to Use` has 2+ trigger conditions
- [ ] `## Execution Steps` uses numbered list with bolded step names
- [ ] `## Output Format` names the artifact and its path
- [ ] `## Related Skills` is present (use `<!-- none -->` if empty)
- [ ] No agent-governance sections (`## Role`, `## ⚠️ PM-ONLY INVOCATION`, `## Dispatch Protocol`)
- [ ] No `## When to Invoke` (rename to `## When to Use`)

---

## 9. Related Documents

- [`variant-specialist-agent-structure.md`](variant-specialist-agent-structure.md) — companion agent spec
- `docs/adr/0042-l2-variant-pipeline-wave15-golden-reference.md` — Wave 1.5 decision record
- `scripts/helpers/normalize-agent-skills.ts` — enforces section naming + frontmatter defaults
- `scripts/helpers/golden-reference-loader.ts` — `SKILL_LAYER1_SECTIONS` constant
- `scripts/audit.ts` — structural gap validation check
