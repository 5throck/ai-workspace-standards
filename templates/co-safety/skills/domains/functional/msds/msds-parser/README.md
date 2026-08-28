# msds-parser

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Parse MSDS/SDS documents into structured GHS 16-section records. Hybrid: Mode 1 rule-based (top 5 Korean suppliers) + Mode 2 ML fallback (external LLM API) when confidence <80%."

- **Scope**: `co-safety`
- **Version**: 1.0.0"

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

(none)

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
