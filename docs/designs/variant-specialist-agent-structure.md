# Variant Specialist Agent File Structure

> **Architect**: Canonical format specification for specialist agent files inside template variants
> **Status**: Active — Implemented
> **Created**: 2026-06-19
> **Last Updated**: 2026-06-19
> **Phase**: Reference Specification

---

## Executive Summary

This document defines the canonical format for specialist agent files located at
`templates/<variant>/agents/<name>.md`. It is distinct from the workspace-root agent format
(`agents/<name>.md`) which has a completely different shape.

---

## 1. Two Agent File Types

| Location | Purpose | Frontmatter | Script |
|----------|---------|-------------|--------|
| `agents/<name>.md` | Workspace-root agents — PM, lifecycle, QA, etc. | No YAML frontmatter; pure Markdown | `scripts/agent-create.ts` |
| `templates/<variant>/agents/<name>.md` | Variant specialist agents — domain specialists within a project variant | YAML frontmatter block required | Created manually; normalized by `generate-variant.ts` |

---

## 2. Canonical Frontmatter (Variant Specialist Agent)

```yaml
---
name: <agent-slug>           # kebab-case, must match filename (without .md)
role: <one-line role description>
status: active               # or: inactive, deprecated
tier:
  claude: <high|medium|low>
  gemini: <high|medium|low>
  antigravity: <high|medium|low>
  gemini-cli: <high|medium|low>
model: inherit               # or explicit model ID
color: <css-color-name>      # used in UI display (blue, green, purple, red, etc.)
description: >-
  <Multi-line description used for agent discovery and dispatch decisions.>
  <First sentence: what the agent produces.>
  <Second sentence: when to dispatch it.>
examples:
  - user: "<sample user prompt>"
    assistant: "<sample one-liner response>"
phases: [<N>, ...]           # workflow phases this agent leads
handoff_to: [<agent-slug>, ...] # downstream agents
handoff_from: [<agent-slug>, ...] # upstream agents (including pm)
required_skills: [<skill-slug>, ...] # skills this agent depends on
---
```

### Field Rules

| Field | Required | Notes |
|-------|----------|-------|
| `name` | Yes | Must match filename without `.md` |
| `role` | Yes | One-line; used for logging and discovery |
| `status` | Yes | `active` for all deployed agents |
| `tier` | Yes | All four platforms required (claude, gemini, antigravity, gemini-cli) |
| `model` | Yes | Use `inherit` unless agent needs a specific model |
| `color` | Yes | CSS color name; used in variant UI |
| `description` | Yes | Block scalar (`>-`); two sentences minimum |
| `examples` | Yes | At least one user/assistant pair |
| `phases` | Yes | Empty list `[]` only if the agent is cross-cutting |
| `handoff_to` | Yes | Empty list `[]` if agent is terminal |
| `handoff_from` | Yes | Always include `pm` unless pm is not a sender |
| `required_skills` | Yes | Empty list `[]` if agent uses no skills |

### Why Four Tier Platforms

The four platforms (`claude`, `gemini`, `antigravity`, `gemini-cli`) correspond to the four
deployment targets. All four must be declared so the `generate-variant.ts` pipeline and
platform-dispatch logic can resolve the correct tier without falling back to defaults.

---

## 3. Canonical Body Sections

Sections must appear in this order:

```markdown
## Role

Short paragraph defining what the agent owns, what phase(s) it leads, and what its primary
output artifact is.

## ⚠️ PM-ONLY INVOCATION

[Standard boilerplate — see §4 below]

## Responsibilities

Bulleted list of concrete responsibilities within the agent's phase(s).

## Output Format

Description of the artifact(s) the agent produces, including file paths and structure.
Reference the corresponding skill file for templates: `see skills/<skill-slug>/SKILL.md`.

## Constraints

Bulleted list of hard constraints the agent must enforce (e.g., "always search in both
Korean and English", "do not start without confirmed topic").

## Meeting Participation

Standard section for /meeting role-play. Defines Voice & Stance, per-turn obligations,
and what the agent does NOT do.

## Dispatch Protocol

Tabular summary of phases, support scope, auto-dispatch target, tier, and communication style.
```

### 4. PM-ONLY INVOCATION Boilerplate

Every specialist agent must refuse direct user invocations. Standard text:

```markdown
## ⚠️ PM-ONLY INVOCATION

**You DO NOT accept direct user requests.**

You are a specialist agent that may ONLY be dispatched by the PM. If a user attempts to invoke you directly:

1. **Refuse the request politely**
2. **Redirect to PM**: "I am a specialist agent. All requests must go through the PM orchestrator. Please submit your task to PM, and they will dispatch me when [domain] work is needed."
3. **Do NOT proceed** with any work until dispatched by PM

This ensures all work flows through the proper N-stage workflow with quality gates.
```

---

## 5. Normalization via `generate-variant.ts`

When `l2-to-variant-pipeline.ts` generates a variant from an L2 project, it calls
`normalizeAgentFrontmatter()` in `scripts/helpers/generate-variant.ts` on every specialist
agent file. This function:

1. **Strips L2-only fields** — removes `lifecycle:`, `formal_name:`, and `variant:` which
   are internal to the L2 workspace and do not belong in variant templates.
2. **Adds missing tier platforms** — if `gemini:`, `antigravity:`, or `gemini-cli:` are absent,
   inherits the `claude:` tier value and inserts the missing platform lines.
3. **Cleans blank lines** — collapses 3+ consecutive blank lines to 2.

L2 agent files may carry additional lifecycle metadata; the normalization function strips it
automatically when producing the variant copy.

---

## 6. Gold Standard Reference

`templates/co-develop/agents/architect.md` is the canonical reference implementation.
When in doubt about any section's format, refer to that file.

`templates/co-deck/agents/` contains the second complete implementation (co-deck variant,
lecture production domain). All seven co-deck agents conform to this specification as of 2026-06-19.

---

## 7. Migration Checklist

Use this checklist when migrating legacy agent files (pre-spec) or adding new agents:

- [ ] Frontmatter has all 9 required fields
- [ ] All four tier platforms declared under `tier:`
- [ ] `model: inherit` unless specific model required
- [ ] `description:` is a block scalar (`>-`) with 2+ sentences
- [ ] At least one `examples:` entry
- [ ] `phases:`, `handoff_to:`, `handoff_from:`, `required_skills:` all present (may be `[]`)
- [ ] Body has sections in canonical order (Role → PM-ONLY → Responsibilities → Output Format → Constraints → Meeting Participation → Dispatch Protocol)
- [ ] `## ⚠️ PM-ONLY INVOCATION` section present with standard refusal text
- [ ] `## Output Format` references corresponding skill file if a skill exists
- [ ] `## Dispatch Protocol` table matches frontmatter `phases` and `handoff_to`

---

## 8. Related Documents

- `docs/constitution/05-multi-agent-architecture.md` — §5.1 workspace-root agent spec
- `docs/designs/l2-to-variant-conversion-pipeline.md` — full pipeline design
- `scripts/helpers/generate-variant.ts` — implements `normalizeAgentFrontmatter()`
- `scripts/agent-create.ts` — creates workspace-root agents (different format, no YAML frontmatter)
