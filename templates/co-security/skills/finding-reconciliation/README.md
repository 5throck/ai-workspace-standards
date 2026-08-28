# finding-reconciliation

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Merges duplicate and overlapping security findings from multiple scan passes and tools into one deduplicated finding set keyed by code location and rule identity, ready for reporting and SARIF export.

- **Scope**: `co-security`
- **Version**: 1.0.0

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

Finding documents in docs/findings/ (FIND-NNNN) and/or scanner outputs covering the same code from two or more passes or tools

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
