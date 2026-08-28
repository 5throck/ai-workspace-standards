# token-usage-lint

> **Seeded from `SKILL.md` frontmatter (2026-08-28 per-skill README standard, CONSTITUTION §6.2).** Refine freely — this file is not auto-regenerated.

## Purpose

Lint procedure that scans co-design UI code for hardcoded design values (raw hex colors, rgb()/hsl() literals, raw px spacing) that bypass the tokens.json SSOT. Use when: reviewing generated UI code, auditing for hardcoded design values, or checking design token compliance in playground demos and handoff artifacts.

- **Scope**: `co-design`
- **Version**: 1.0.1

## When to Use

- Load when the task matches the purpose above (see `SKILL.md` description).

## Prerequisites

none

## Usage

```
bun <invocation per SKILL.md — or load as an AI skill via the platform skill registry>
```

See [SKILL.md](SKILL.md) for the authoritative instructions and frontmatter.
