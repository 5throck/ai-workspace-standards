# project-review

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Performs a comprehensive parallel review of the current project using all available specialist agents. Auto-detects project type and agent roster, generates an execution plan, dispatches agents in parallel, and produces a prioritized improvement plan (Critical/High/Medium/Low). Use when: user requests a full project review ("/project-review" or "do a full project review"); PM detects structural changes (3+ agent files modified, phase schema changes, variant.json modified, new domain added); QA escalation from auditor (safety-audit.ts ERROR >= 3 or Critical finding).

- **Scope**: `co-safety`
- **Version**: 1.1.0

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

(none)

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
