# Variant Specialist Agent File Structure

> **Architect**: Canonical format specification for specialist agent files inside template variants
> **Status**: Active — Implemented
> **Created**: 2026-06-19
> **Last Updated**: 2026-10-27
> **Phase**: Reference Specification

> (Amended 2026-10-27: tier declaration normalized to the scalar form per ADR-0102.)

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
tier: <high|medium|low>      # one scalar line (ADR-0102); no per-platform lines
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
| `tier` | Yes | One scalar line: `high`, `medium`, or `low` (ADR-0102). No per-platform sub-keys or `# model-id` comments |
| `model` | Yes | Use `inherit` unless agent needs a specific model |
| `color` | Yes | CSS color name; used in variant UI |
| `description` | Yes | Block scalar (`>-`); two sentences minimum |
| `examples` | Yes | At least one user/assistant pair |
| `phases` | Yes | Empty list `[]` only if the agent is cross-cutting |
| `handoff_to` | Yes | Empty list `[]` if agent is terminal |
| `handoff_from` | Yes | Always include `pm` unless pm is not a sender |
| `required_skills` | Yes | Empty list `[]` if agent uses no skills |

### Why a Scalar Tier

The agent declares its cost ceiling as one scalar `tier: high|medium|low` line (ADR-0102).
The platform→model mapping is NOT declared in the agent file: `docs/workspace-schema.json`
`models` is the only tier→model registry, resolved at dispatch/validation time. No
per-platform tier sub-keys (`claude:`, `gemini:`, ...) and no `# model-id` comments —
a legacy per-platform map block is collapsed to the scalar form by `normalizeAgentFrontmatter()`
during variant generation (uniform map) and WARNed by `validate-model-registry.ts` v2 otherwise.

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

When `l2-to-variant-pipeline.ts` generates a variant from an L3 project, it calls
`normalizeAgentFrontmatter()` in `scripts/helpers/generate-variant.ts` on every specialist
agent file. This function:

1. **Strips L3-only fields** — removes `formal_name:` and `variant:` which
   are internal to the L3 source and do not belong in variant templates.
2. **Collapses map-form tier to the scalar form** — a uniform per-platform
   tier map (`claude:`/`gemini:`/... with the same value) is replaced by one
   scalar `tier: <value>` line (ADR-0102); a mixed-value map is left as-is
   with a loud WARN, and a scalar tier passes through unchanged.
3. **Cleans blank lines** — collapses 3+ consecutive blank lines to 2.

L2 agent files carry their own lifecycle metadata; the normalization function preserves it when
producing the variant copy (since `generate-variant.ts` 1.12.0 / PR #607 — L2 governance records
reference it, and the old stripping behavior forced manual backfills of 59 agents in PR #588).

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
- [ ] Scalar `tier: high|medium|low` declared (one line, no per-platform sub-keys — ADR-0102)
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
